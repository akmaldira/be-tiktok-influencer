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
  TiktokCreatorVideo,
  TiktokPopularHashtagResponse,
  TiktokVideoTimelineByHashtag,
  TiktokVideosByHashtagResponse,
} from "../tiktok-types";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getHeaders({ page }: { page: Page }) {
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  );
  await page.goto(
    `https://ads.tiktok.com/business/creativecenter/inspiration/popular/creator/pc/en`,
  );

  const request = await page.waitForRequest(
    (req) => {
      return req
        .url()
        .includes(
          "https://ads.tiktok.com/creative_radar_api/v1/popular_trend/creator/list",
        );
    },
    { timeout: 15000 },
  );

  const headers = request.headers();
  if (
    !headers.timestamp ||
    !headers["user-sign"] ||
    !headers["anonymous-user-id"]
  ) {
    throw new Error(
      `getAndSetTiktokRequestHeader error reason: missing required headers`,
    );
  }

  return headers;
}

async function getVideoByHashtag({
  page,
  data,
}: {
  page: Page;
  data: { hashtag: string; industry_id: string };
}) {
  if (!data.hashtag) {
    throw new Error(`getVideoByHashtag error reason: missing hashtag`);
  }

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  );

  await page.goto(`https://www.tiktok.com/tag/${data.hashtag}?lang=en`, {
    timeout: 15000,
  });

  const networkResponse = await page.waitForResponse(
    async (res) => {
      const url = res.url();
      const status = res.status();
      return (
        url.includes("https://www.tiktok.com/api/challenge/item_list") &&
        status === 200
      );
    },
    {
      timeout: 15000,
    },
  );

  const response: TiktokVideosByHashtagResponse = await networkResponse.json();
  const industry = await TiktokIndustryEntity.findOneOrFail({
    where: { id: data.industry_id },
    relations: ["creators"],
  });

  const distinctVideosAuthor = response.itemList.filter((v, i, a) => {
    const { like, share, comment, view } = TiktokHelper.getStats(v);
    const engagementRate = (like + share + comment) / view;
    const minimumEngagement = 0.05;
    return (
      engagementRate >= minimumEngagement &&
      like > 500000 &&
      a.findIndex((t) => t.author!.uniqueId === v.author!.uniqueId) === i
    );
  });
  await Promise.all(
    distinctVideosAuthor.map(async (video) => {
      return upsertCreatorFromVideo(video, industry);
    }),
  );
}

async function getCreatorDetailAndVideo({
  page,
  data: { uniqueId },
}: {
  page: Page;
  data: { uniqueId: string; tryCount: number };
}) {
  const videosResponseTemp: TiktokVideosByHashtagResponse[] = [];
  let creatorRes: TiktokCreatorDetail | undefined;

  const pendingPromise = await new Promise(
    async (
      resolve: ({
        creatorRes,
        videoRes,
      }: {
        creatorRes: TiktokCreatorDetail;
        videoRes: TiktokVideosByHashtagResponse[];
      }) => void,
      reject,
    ) => {
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      );

      page.on("response", async (res) => {
        const url = res.url();
        const status = res.status();

        if (
          url.includes(`https://www.tiktok.com/@${uniqueId}`) &&
          status === 200
        ) {
          const response = await res.text();
          const tempData = response.match(
            /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"([^>]+)>([^<]+)<\/script>/,
          );
          if (!tempData) {
            return reject(new Error("No data found"));
          }

          const jsonData = JSON.parse(tempData[2]) as any;
          const creatorJsonData =
            jsonData["__DEFAULT_SCOPE__"]["webapp.user-detail"];
          const creatorDetail = creatorJsonData.userInfo
            .user as TiktokCreatorDetail;

          if (!creatorDetail) {
            return reject(new Error("No creator data found"));
          }
          creatorRes = creatorDetail;
        } else if (
          url.includes("https://www.tiktok.com/api/post/item_list") &&
          status === 200
        ) {
          const response: TiktokVideosByHashtagResponse = await res.json();
          if (!videosResponseTemp.find((v) => v.cursor == response.cursor)) {
            videosResponseTemp.push(response);
            if (response.hasMore) {
              console.log(
                `Fetched ${response.itemList.length} videos for ${uniqueId}. scrolling...`,
              );
              await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
              });
              await sleep(1500);
            } else {
              const totalVideo = videosResponseTemp.reduce(
                (acc, curr) => acc + curr.itemList.length,
                0,
              );
              console.log(
                `Fetched ${totalVideo} videos for creator ${uniqueId}`,
              );
              if (creatorRes) {
                return resolve({ creatorRes, videoRes: videosResponseTemp });
              } else {
                return reject(new Error("No creator data found"));
              }
            }
          }
        }
      });

      await page.goto(`https://www.tiktok.com/@${uniqueId}?lang=en`, {
        timeout: 120000,
      });
    },
  );

  return pendingPromise;
}

async function getVideoDetail(
  videoId: string,
  uniqueId: string,
): Promise<TiktokCreatorVideo | undefined> {
  try {
    const res = await axios.get(
      `https://www.tiktok.com/@${uniqueId}/video/${videoId}`,
    );

    if (res.status !== 200) {
      throw new Error(`status code ${res.status}`);
    }

    const resData = res.data.match(
      /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"([^>]+)>([^<]+)<\/script>/,
    );
    if (!resData) {
      throw new Error("No data found");
    }
    const jsonData = JSON.parse(resData[2]) as any;
    const videoDetail: any | undefined =
      jsonData["__DEFAULT_SCOPE__"]["webapp.video-detail"]["itemInfo"][
        "itemStruct"
      ];
    return videoDetail;
  } catch (error: any) {
    if (error.message == "Request failed with status code 403") {
      console.log(
        `Error fetching video detail ${videoId} for ${uniqueId}. Retry...`,
      );
      await sleep(1000);
      return getVideoDetail(videoId, uniqueId);
    }
    console.log(
      `Error fetching video detail ${videoId} for ${uniqueId}. Skipping`,
    );
    return undefined;
  }
}

async function getCreatorData({
  page,
  data: { uniqueId, creatorId },
}: {
  page: Page;
  data: { uniqueId: string; creatorId: string; tryCount: number };
}) {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  console.log(`Fetching creator data for ${uniqueId}`);
  const data = await getCreatorDetailAndVideo({
    page,
    data: { uniqueId, tryCount: 0 },
  });

  const creatorDetail = data.creatorRes;
  const videosResponse = data.videoRes;
  const videos = videosResponse.flatMap((v) => v.itemList);
  const country = await TiktokCountryEntity.findOneOrFail({
    where: { id: creatorDetail.region! },
  });

  const videosToUpsert = videos.map((v) => {
    const videoEntity = new CreatorVideoEntity();
    const stats = TiktokHelper.getStats(v);
    videoEntity.id = v.id;
    videoEntity.createTime = v.createTime;
    videoEntity.desc = v.desc;
    videoEntity.textExtra = v.textExtra;
    videoEntity.likeCount = stats.like;
    videoEntity.shareCount = stats.share;
    videoEntity.commentCount = stats.comment;
    videoEntity.viewCount = stats.view;
    videoEntity.collectCount = v.stats.collectCount;
    videoEntity.creator = {
      id: creatorId,
      uniqueId,
    } as CreatorEntity;
    return videoEntity;
  });

  await CreatorEntity.update(
    {
      uniqueId: uniqueId,
    },
    {
      bioLink: creatorDetail.bioLink?.link,
      language: creatorDetail.language,
      country: {
        id: country.id,
      },
    },
  );

  const upsert = await CreatorVideoEntity.upsert(videosToUpsert, ["id"]);
  console.log(
    `Upserted ${upsert.identifiers.length} videos for creator ${uniqueId}`,
  );
  return upsert;

  // let totalLike = 0;
  // let totalShare = 0;
  // let totalComment = 0;
  // let totalView = 0;
  // let totalCollect = 0;

  // upsert.identifiers.map(async (v) => {
  //   console.log(`Fetching video detail ${v.id} for ${uniqueId}`);
  //   const videoDetail = await getVideoDetail(v.id, creatorDetail.uniqueId);
  //   if (videoDetail) {
  //     const stats = TiktokHelper.getStats(videoDetail);
  //     totalLike += stats.like;
  //     totalShare += stats.share;
  //     totalComment += stats.comment;
  //     totalView += stats.view;
  //     totalCollect += videoDetail.stats.collectCount;

  //     await CreatorVideoEntity.update(
  //       {
  //         id: v.id,
  //       },
  //       {
  //         suggestedWords: videoDetail.suggestedWords,
  //         potentialCategories: videoDetail.diversificationLabels,
  //         address: videoDetail.contentLocation?.address?.streetAddress,
  //         likeCount: stats.like,
  //         shareCount: stats.share,
  //         commentCount: stats.comment,
  //         viewCount: stats.view,
  //         collectCount: videoDetail.stats.collectCount,
  //       },
  //     );
  //   }
  //   await sleep(1000);
  // });

  // if (totalLike > 0 && totalShare > 0 && totalComment > 0 && totalView > 0) {
  //   await CreatorEntity.update(
  //     {
  //       uniqueId: uniqueId,
  //     },
  //     {
  //       likeCount: totalLike,
  //       shareCount: totalShare,
  //       commentCount: totalComment,
  //       viewCount: totalView,
  //       collectCount: totalCollect,
  //     },
  //   );
  // }
}

async function getPopularHashtags({
  headersList,
  country,
  industries,
}: {
  headersList: Record<string, string>[];
  country: TiktokCountryEntity;
  industries: TiktokIndustryEntity[];
}) {
  if (headersList.length != industries.length) {
    throw new Error(
      `getPopularHashtags error reason: headers and industries length mismatch`,
    );
  }

  const popularHashtags = [] as TiktokPopularHashtagResponse[];

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
        headers,
      },
    );

    const resData = await response.data;
    if (!resData || resData.code != 0) {
      throw new Error(`getPopularHashtags error reason: invalid response data`);
    }

    console.log(`Fetched popular hashtags for industry ${industry.value}`);
    const data = resData.data as TiktokPopularHashtagResponse;
    const distinctHashtagsList = data.list.filter(
      (v, i, a) => a.findIndex((t) => t.hashtag_name === v.hashtag_name) === i,
    );
    await upsertPopularHashtag(distinctHashtagsList, country, industry);
    popularHashtags.push(data);
  }

  console.log(`Fetched popular hashtags for all industries`);
  return popularHashtags;
}

async function upsertCreatorFromVideo(
  video: TiktokVideoTimelineByHashtag,
  industry: TiktokIndustryEntity,
) {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  if (!video.author) throw new Error(`Author not found in video ${video.id}`);
  let creatorEntity = await CreatorEntity.findOne({
    where: { uniqueId: video.author.uniqueId },
    relations: ["industries"],
  });

  const newSocial = TiktokHelper.getCreatorSocialFromSignature({
    creator: video.author,
  });
  if (!creatorEntity) {
    creatorEntity = new CreatorEntity();
    creatorEntity.id = video.author.id;
    creatorEntity.uniqueId = video.author.uniqueId;
    creatorEntity.visibility = false;
    creatorEntity.instagram = newSocial.instagram;
    creatorEntity.email = newSocial.email;
    creatorEntity.phone = newSocial.phone;
    creatorEntity.updateCount = 0;
    creatorEntity.industries = [];
  } else {
    creatorEntity.instagram = newSocial.instagram || creatorEntity.instagram;
    creatorEntity.email = newSocial.email || creatorEntity.email;
    creatorEntity.phone = newSocial.phone || creatorEntity.phone;
    creatorEntity.updateCount = creatorEntity.updateCount += 1;
  }
  creatorEntity.nickName = video.author.nickname;
  creatorEntity.avatar = video.author.avatarThumb;
  creatorEntity.ttSeller = video.author.ttSeller;
  creatorEntity.private = video.author.privateAccount;
  creatorEntity.verified = video.author.verified;
  creatorEntity.description = video.author.signature
    ? video.author.signature.length == 0
      ? null
      : video.author.signature
    : null;
  creatorEntity.followerCount = video.authorStats?.followerCount || null;
  creatorEntity.likeCount = video.authorStats?.heartCount || null;
  creatorEntity.industries = [...creatorEntity.industries, industry];

  await CreatorEntity.save(creatorEntity);
  console.log(`Upserted creator ${creatorEntity.uniqueId}`);
  return creatorEntity;
}

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

(async () => {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }
  puppeteer.use(StealthPlugin());
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: 1,
    puppeteer,
    puppeteerOptions: {
      headless: false,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  cluster.on("taskerror", (err, data) => {
    if (data && data.tryCount) {
      if (data.tryCount < 3) {
        const tryCount = data.tryCount + 1;
        cluster.queue({ ...data, tryCount }, getCreatorDetailAndVideo);
      }
    }

    if (data && data.hashtag) {
      console.log(`Error crawling ${data.hashtag}: ${err}`);
    } else if (data && data.uniqueId) {
      console.log(`Error crawling ${data.uniqueId}: ${err}`);
    } else {
      console.log(`Error crawling: ${err}`);
    }
  });

  const creators = await CreatorEntity.find({
    where: {
      visibility: false,
    },
    order: {
      followerCount: "ASC",
    },
    take: 100,
  });

  for (const creator of creators) {
    cluster.queue(
      { uniqueId: creator.uniqueId, creatorId: creator.id, tryCount: 0 },
      getCreatorData,
    );
  }

  // const country = await TiktokCountryEntity.findOneOrFail({
  //   where: {
  //     id: "ID",
  //   },
  // });
  // const industries = await TiktokIndustryEntity.find({
  //   order: {
  //     id: "ASC",
  //   },
  // });

  // const headersList = [] as Record<string, string>[];
  // console.log(`Fetching headers for all industries...`);
  // for (let i = 0; i < industries.length; i++) {
  //   try {
  //     const headers = await cluster.execute(getHeaders);
  //     console.log(`Fetched headers for industry ${industries[i].value}`);
  //     headersList.push(headers);
  //   } catch (error) {
  //     console.log(
  //       `Error fetching headers for industry ${industries[i].value}. Retry...`,
  //     );
  //     i--;
  //   }
  // }

  // const popularHashtagResponseList = await getPopularHashtags({
  //   headersList,
  //   country,
  //   industries,
  // });

  // for (const hashtagResponse of popularHashtagResponseList) {
  //   for (const hashtag of hashtagResponse.list) {
  //     cluster.queue({ hashtag: hashtag.hashtag_name }, getVideoByHashtag);
  //   }
  // }

  await cluster.idle();
  await cluster.close();
})();
