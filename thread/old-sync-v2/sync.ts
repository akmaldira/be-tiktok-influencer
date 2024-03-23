import axios from "axios";
import { Page } from "puppeteer";
import { Cluster } from "puppeteer-cluster";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import dataSource from "../../src/database/data-source";
import CreatorVideoEntity from "../../src/database/entities/creator-video.entity";
import CreatorEntity from "../../src/database/entities/creator.entity";
import TiktokCountryEntity from "../../src/database/entities/tiktok-country.entity";
import TiktokHashtagEntity from "../../src/database/entities/tiktok-hashtag.entity";
import TiktokIndustryEntity from "../../src/database/entities/tiktok-industry.entity";
import TiktokHelper from "../tiktok-helper";
import {
  PopularHashtag,
  TiktokCreatorDetail,
  TiktokPopularHashtagResponse,
  TiktokVideoAuthor,
  TiktokVideoStats,
  TiktokVideoTimelineByHashtag,
  TiktokVideosByHashtagResponse,
} from "../tiktok-types";

const DEFAULT_TIMEOUT = 15000;
const DEFAULT_RETRY = 3;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getHeaders({ page }: { page: Page }) {
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  );
  await page.goto(
    `https://ads.tiktok.com/business/creativecenter/inspiration/popular/creator/pc/en`,
    {
      timeout: DEFAULT_TIMEOUT,
    },
  );

  const request = await page.waitForRequest(
    (req) => {
      return req
        .url()
        .includes(
          "https://ads.tiktok.com/creative_radar_api/v1/popular_trend/creator/list",
        );
    },
    { timeout: DEFAULT_TIMEOUT },
  );

  const headers = request.headers();
  if (
    !headers.timestamp ||
    !headers["user-sign"] ||
    !headers["anonymous-user-id"]
  ) {
    throw new Error(`getHeaders error reason: missing required headers`);
  }

  return {
    timestamp: headers.timestamp,
    userSign: headers["user-sign"],
    anonymousUserId: headers["anonymous-user-id"],
  };
}

async function getVideoByHashtag({
  page,
  data,
}: {
  page: Page;
  data: { hashtag: PopularHashtag };
}): Promise<TiktokVideoTimelineByHashtag[]> {
  if (!data.hashtag) {
    throw new Error(`getVideoByHashtag error reason: missing hashtag`);
  }

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  );

  await page.goto(
    `https://www.tiktok.com/tag/${data.hashtag.hashtag_name}?lang=en,`,
    {
      timeout: DEFAULT_TIMEOUT,
    },
  );

  const itemListResponse = await page.waitForResponse(
    async (res) => {
      const url = res.url();
      const status = res.status();
      return (
        url.includes("https://www.tiktok.com/api/challenge/item_list") &&
        status === 200
      );
    },
    {
      timeout: DEFAULT_TIMEOUT,
    },
  );

  const response: TiktokVideosByHashtagResponse = await itemListResponse.json();

  const distinctVideosAuthor = response.itemList.filter((v, i, a) => {
    const { like, share, comment, view } = TiktokHelper.getStats(v);
    const engagementRate = (like + share + comment) / view;
    const minimumEngagement = 0.05;
    return (
      engagementRate >= minimumEngagement &&
      view > 500000 &&
      a.findIndex((t) => t.author!.uniqueId === v.author!.uniqueId) === i
    );
  });

  return distinctVideosAuthor;
}

async function getMoreCreatorDataAndVideo({
  page,
  data: { author, industry, task = "getMoreCreatorDataAndVideo" },
}: {
  page: Page;
  data: {
    author: TiktokVideoAuthor;
    industry: TiktokIndustryEntity;
    task: string;
  };
}) {
  console.log(`Processing task ${task} for creator @${author.uniqueId}`);
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  );

  page.goto(`https://www.tiktok.com/@${author.uniqueId}`, {
    timeout: DEFAULT_TIMEOUT * 4,
  });

  const indexResponse = await page.waitForResponse(
    async (res) => {
      const url = res.url();
      const status = res.status();
      return (
        url.includes(`https://www.tiktok.com/@${author.uniqueId}`) &&
        status === 200
      );
    },
    { timeout: DEFAULT_TIMEOUT },
  );

  const html = await indexResponse.text();

  const match = html.match(
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"([^>]+)>([^<]+)<\/script>/,
  );
  if (!match) {
    if (html.includes("Please wait...")) {
      console.log(html);
    }
    throw new Error(`getMoreCreatorData error reason: invalid response data`);
  }
  const jsonData = JSON.parse(match[2]) as any;
  const creatorJsonData = jsonData["__DEFAULT_SCOPE__"]["webapp.user-detail"];
  const creatorDetail = creatorJsonData.userInfo as {
    user: TiktokCreatorDetail;
    stats: TiktokVideoStats;
  };
  const videoResponse = await page.waitForResponse(
    async (res) => {
      const url = res.url();
      const status = res.status();
      return (
        url.includes(`https://www.tiktok.com/api/post/item_list`) &&
        status === 200
      );
    },
    {
      timeout: DEFAULT_TIMEOUT,
    },
  );
  const videoData: TiktokVideosByHashtagResponse = await videoResponse.json();

  const creator = await upsertCreatorDetail(creatorDetail, industry);
  if (!creator) {
    return;
  }
  await upsertCreatorVideos(videoData.itemList, creator);
  return;
}

// NON BROWSER
async function getPopularHashtags({
  headersList,
  country,
  industries,
  retry = 0,
}: {
  headersList: Record<string, string>[];
  country: TiktokCountryEntity;
  industries: TiktokIndustryEntity[];
  retry?: number;
}) {
  try {
    if (headersList.length != industries.length) {
      throw new Error(
        `getPopularHashtags error reason: headers and industries length mismatch`,
      );
    }

    const popularHashtags = [] as {
      popular: PopularHashtag[];
      industry: TiktokIndustryEntity;
    }[];

    for (let i = 0; i < headersList.length; i++) {
      const industry = industries[i];
      const headers = headersList[i];

      const searchParams = new URLSearchParams({
        page: "1",
        limit: "50",
        period: "7",
        country_code: country.id,
        industry_id: industry.id,
        sort_by: "popular",
      });
      const response = await axios.get(
        `https://ads.tiktok.com/creative_radar_api/v1/popular_trend/hashtag/list?${searchParams.toString()}`,
        {
          headers: {
            Accept: "application/json, text/plain, */*",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            Timestamp: headers.timestamp,
            "User-Sign": headers.userSign,
            "Anonymous-User-Id": headers.anonymousUserId,
          },
        },
      );

      const resData = await response.data;
      if (!resData || resData.code != 0) {
        throw new Error(
          `getPopularHashtags error reason: invalid response data`,
        );
      }

      console.log(`Fetched popular hashtags for industry ${industry.value}`);
      const data = resData.data as TiktokPopularHashtagResponse;
      const distinctHashtagsList = data.list.filter(
        (v, i, a) =>
          a.findIndex((t) => t.hashtag_name === v.hashtag_name) === i,
      );
      await upsertPopularHashtag(distinctHashtagsList, country, industry);
      popularHashtags.push({
        popular: distinctHashtagsList,
        industry,
      });
    }

    console.log(`Fetched popular hashtags for all industries`);
    return popularHashtags;
  } catch (error) {
    if (retry < DEFAULT_RETRY - 1) {
      console.log(`Error fetching popular hashtags. Retrying...`);
      return getPopularHashtags({
        headersList,
        country,
        industries,
        retry: retry + 1,
      });
    }
    console.log(`Error fetching popular hashtags. Skipping...`);
    return [];
  }
}

async function getMoreCreatorData(uniqueId: string, retry = 0) {
  try {
    console.log(`Fetching creator @${uniqueId}`);
    const res = await axios.get(`https://www.tiktok.com/@${uniqueId}`);
    const html = res.data;
    const match = html.match(
      /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"([^>]+)>([^<]+)<\/script>/,
    );
    if (!match) {
      if (html.includes("Please wait...")) {
        console.log(html);
        console.log(
          `getMoreCreatorData error reason: please wait... retrying in 5 sec...`,
        );
        await sleep(5000);
        return getMoreCreatorData(uniqueId, retry);
      }
      throw new Error(`getMoreCreatorData error reason: invalid response data`);
    }
    const jsonData = JSON.parse(match[2]) as any;
    const creatorJsonData = jsonData["__DEFAULT_SCOPE__"]["webapp.user-detail"];
    const creatorDetail = creatorJsonData.userInfo as {
      user: TiktokCreatorDetail;
      stats: TiktokVideoStats;
    };
    return creatorDetail;
  } catch (error: any) {
    if (retry < DEFAULT_RETRY - 1) {
      if (error.message == "Request failed with status code 403") {
        console.log(error);
        console.log(
          `Error fetching creator @${uniqueId} (${error.message}). Retrying in 5 sec...`,
        );
        await sleep(5000);
        return getMoreCreatorData(uniqueId, retry);
      }
      console.log(
        `Error fetching creator @${uniqueId} (${error.message}). Retrying...`,
      );
      return getMoreCreatorData(uniqueId, retry + 1);
    }
    console.log(
      `Error fetching creator @${uniqueId} (${error.message}). Skipping...`,
    );
    return;
  }
}

// DATABASE
async function upsertPopularHashtag(
  hashtags: PopularHashtag[],
  country: TiktokCountryEntity,
  industry: TiktokIndustryEntity,
) {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  await dataSource.transaction(async (manager) => {
    const tiktokHashtags = await manager.find(TiktokHashtagEntity);
    const popularHashtagMetaData: Partial<TiktokHashtagEntity>[] = hashtags.map(
      (hashtag) => {
        const existingHashtag = tiktokHashtags.find(
          (v) => v.name === hashtag.hashtag_name,
        );
        return {
          id: existingHashtag ? existingHashtag.id : hashtag.hashtag_id,
          name: hashtag.hashtag_name,
          isPromoted: hashtag.is_promoted,
          publishCount: hashtag.publish_cnt,
          videoViews: hashtag.video_views,
          trend: hashtag.trend,
          updateCount: existingHashtag ? existingHashtag.updateCount++ : 0,
          country,
          industry,
        };
      },
    );

    await manager.upsert(TiktokHashtagEntity, popularHashtagMetaData, ["id"]);
  });
}

async function upsertCreatorDetail(
  {
    user,
    stats,
  }: {
    user: TiktokCreatorDetail;
    stats: TiktokVideoStats;
  },
  industry: TiktokIndustryEntity,
  retry: number = 0,
) {
  try {
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }

    let creator = await CreatorEntity.findOne({
      where: {
        id: user.id,
      },
    });

    console.log(`Upserting creator @${user.uniqueId}`);
    const social = TiktokHelper.getCreatorSocialFromSignature({
      creator: user,
    });
    if (creator) {
      creator.uniqueId = user.uniqueId;
      creator.nickName = user.nickname || creator.nickName;
      creator.ttSeller = user.ttSeller;
      creator.language = user.language || creator.language;
      creator.avatar = user.avatarThumb || creator.avatar;
      creator.private = user.privateAccount;
      creator.verified = user.verified;
      creator.visibility = false;
      creator.description = user.signature || creator.description;
      creator.bioLink = user.bioLink?.link || creator.bioLink;
      creator.email = social.email || creator.email;
      creator.phone = social.phone || creator.phone;
      creator.instagram = social.instagram || creator.instagram;
      creator.followerCount = stats.followerCount || creator.followerCount;
      creator.likeCount = stats.heartCount || creator.likeCount;
      creator.videoCount = stats.videoCount || creator.videoCount;
      creator.country = {
        id: user.region,
      } as TiktokCountryEntity;
    } else {
      creator = new CreatorEntity();
      creator.id = user.id;
      creator.uniqueId = user.uniqueId;
      creator.nickName = user.nickname;
      creator.ttSeller = user.ttSeller;
      creator.language = user.language;
      creator.avatar = user.avatarThumb;
      creator.private = user.privateAccount;
      creator.verified = user.verified;
      creator.visibility = false;
      creator.description = user.signature;
      creator.bioLink = user.bioLink?.link || creator.bioLink;
      creator.email = social.email;
      creator.phone = social.phone;
      creator.instagram = social.instagram;
      creator.followerCount = stats.followerCount;
      creator.likeCount = stats.heartCount;
      creator.videoCount = stats.videoCount;
      creator.country = {
        id: user.region,
      } as TiktokCountryEntity;
    }

    await CreatorEntity.save(creator);
    industry.creators = [...(industry.creators || []), creator];
    await TiktokIndustryEntity.save(industry);
    return creator;
  } catch (error: any) {
    if (retry < DEFAULT_RETRY - 1) {
      console.log(
        `Error upserting creator @${user.uniqueId} (${error.message}). Retrying...`,
      );
      return upsertCreatorDetail({ user, stats }, industry, retry + 1);
    }
    console.log(
      `Error upserting creator @${user.uniqueId} (${error.message}). Skipping...`,
    );
    return;
  }
}

async function upsertCreatorVideos(
  videos: TiktokVideoTimelineByHashtag[],
  creator: CreatorEntity,
  retry: number = 0,
) {
  try {
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }

    console.log(`Upserting videos for creator @${creator.uniqueId}`);
    const videosMetaData: Partial<CreatorVideoEntity>[] = videos.map(
      (video) => {
        const stats = TiktokHelper.getStats(video);
        return {
          id: video.id,
          desc: video.desc,
          createTime: video.createTime,
          textExtra: video.textExtra,
          viewCount: stats.view,
          likeCount: stats.like,
          shareCount: stats.share,
          commentCount: stats.comment,
          collectCount: video.stats.collectCount,
          creator,
        };
      },
    );

    await CreatorVideoEntity.upsert(videosMetaData, ["id"]);
  } catch (error: any) {
    if (retry < DEFAULT_RETRY - 1) {
      console.log(
        `Error upserting videos for creator @${creator.uniqueId} (${error.message}). Retrying...`,
      );
      return upsertCreatorVideos(videos, creator, retry + 1);
    }
    console.log(
      `Error upserting videos for creator @${creator.uniqueId} (${error.message}). Skipping...`,
    );
    return;
  }
}

async function stepOne() {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  puppeteer.use(StealthPlugin());
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: 6,
    puppeteer,
    puppeteerOptions: {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
    retryLimit: 3,
    retryDelay: 5000,
    timeout: 60000,
  });

  cluster.on("taskerror", (err, data, retry) => {
    if (data.task == "getMoreCreatorDataAndVideo") {
      if (retry) {
        console.log(
          `Error crawling @${data.author.uniqueId}: ${err.message}. This queue will be retried.`,
        );
      } else {
        console.log(
          `Error crawling @${data.author.uniqueId}: ${err.message}. This queue will NOT be retried.`,
        );
      }
      return;
    }
    console.log(`Error crawling ${data}: ${err.message}`);
  });

  const country = await TiktokCountryEntity.findOneByOrFail({ id: "ID" });
  const industries = await TiktokIndustryEntity.find({
    order: {
      id: "ASC",
    },
    take: 1,
  });

  const headersList: {
    timestamp: string;
    userSign: string;
    anonymousUserId: string;
  }[] = [];

  let getHeadersTry = 0;
  for (let i = 0; i < industries.length; i++) {
    const industry = industries[i];
    try {
      const headers = await cluster.execute(getHeaders);
      headersList.push(headers);
      console.log(`Fetched headers for industry ${industry.value}`);
      getHeadersTry = 0;
    } catch (error: any) {
      if (getHeadersTry < DEFAULT_RETRY - 1) {
        console.log(
          `Error fetching headers for industry ${industry.value}. Retrying...`,
        );
        i--;
        getHeadersTry++;
      } else {
        console.log(
          `Error fetching headers for industry ${industry.value}. Skipping...`,
        );
        getHeadersTry = 0;
        throw error;
      }
    }
  }

  const hashtagWithIndustry = await getPopularHashtags({
    headersList,
    country,
    industries,
  });

  const hashtagList = hashtagWithIndustry.reduce(
    (acc, v) => [
      ...acc,
      ...v.popular.map((t) => ({ ...t, industry_id: v.industry.id })),
    ],
    [] as (PopularHashtag & { industry_id: string })[],
  );

  let getAndUpsertTry = 0;
  for (let i = 0; i < hashtagList.length; i++) {
    const hashtag = hashtagList[i];
    try {
      console.log(`Fetching creators for hashtag ${hashtag.hashtag_name}`);
      const videos = (await cluster.execute(
        {
          hashtag,
        },
        getVideoByHashtag,
      )) as TiktokVideoTimelineByHashtag[];

      console.log(
        `Fetched ${videos.length} unique creators with kriteria for hashtag ${hashtag.hashtag_name}`,
      );
      const industry = await TiktokIndustryEntity.findOneOrFail({
        where: {
          id: hashtag.industry_id,
        },
        relations: ["creators"],
      });

      for (const video of videos) {
        const author = video.author;
        if (!author) {
          continue;
        }
        cluster.queue(
          { author, industry, task: "getMoreCreatorDataAndVideo" },
          getMoreCreatorDataAndVideo,
        );
      }

      getAndUpsertTry = 0;
    } catch (error: any) {
      if (getAndUpsertTry < DEFAULT_RETRY - 1) {
        console.log(
          `Error fetching videos for hashtag ${hashtag.hashtag_name} (${error.message}). Retrying...`,
        );
        i--;
        getAndUpsertTry++;
      } else {
        console.log(
          `Error fetching videos for hashtag ${hashtag.hashtag_name} (${error.message}). Skipping...`,
        );
        getAndUpsertTry = 0;
      }
    }
  }

  await cluster.idle();
  await cluster.close();
}

async function main() {
  await stepOne();
}

main();
