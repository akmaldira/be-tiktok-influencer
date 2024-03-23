import { Page } from "puppeteer";
import { Cluster } from "puppeteer-cluster";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import {
  TiktokCreatorDetail,
  TiktokVideoStats,
  TiktokVideoTimelineByHashtag,
  TiktokVideoTimelineWithHashtag,
  TiktokVideosByHashtagResponse,
} from "./tiktok-types";

function extractCreatorDataFromHTML(html: string) {
  const match = html.match(
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"([^>]+)>([^<]+)<\/script>/,
  );
  if (!match) {
    if (html.includes("Please wait...")) {
      console.log(html);
    }
    throw new Error(`Cannot find creator data in HTML`);
  }
  const jsonData = JSON.parse(match[2]) as any;
  const creatorJsonData = jsonData["__DEFAULT_SCOPE__"]["webapp.user-detail"];
  const creatorDetail = creatorJsonData.userInfo as {
    user: TiktokCreatorDetail;
    stats: TiktokVideoStats;
  };
  return creatorDetail;
}

function extractCreatorVideosFromJSON(
  videoResponse: TiktokVideosByHashtagResponse,
) {
  // Take only 30 first videos
  const topVideos = videoResponse.itemList.slice(0, 30);
  return topVideos;
}

async function getCreatorData({
  page,
  data,
}: {
  page: Page;
  data: { video: TiktokVideoTimelineWithHashtag };
}) {
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  );
  page.goto(`https://www.tiktok.com/@${data.video.author.uniqueId}`);

  const creatorDataResponse = await page.waitForResponse(async (res) => {
    const url = res.url();
    const status = res.status();
    return (
      url.includes(`https://www.tiktok.com/@${data.video.author.uniqueId}`) &&
      status === 200
    );
  });
  const html = await creatorDataResponse.text();
  const creator = extractCreatorDataFromHTML(html);

  const latestVideos = await page.waitForResponse((res) => {
    const url = res.url();
    const status = res.status();
    return (
      url.includes(`https://www.tiktok.com/api/post/item_list`) &&
      status === 200
    );
  });
  const videos: TiktokVideosByHashtagResponse = await latestVideos.json();
  const videoList = extractCreatorVideosFromJSON(videos);

  return {
    creator: creator.user,
    videos: videoList,
  };
}

export default async function taskGetCreatorData(
  videoByHashtags: TiktokVideoTimelineWithHashtag[],
  clusterOptions: {
    maxConcurrency?: number;
    retryLimit?: number;
    retryDelay?: number;
    timeout?: number;
  } = {},
  maxRetryEachVideo: number = 3,
) {
  puppeteer.use(StealthPlugin());
  const cluster: Cluster<
    { video: TiktokVideoTimelineWithHashtag },
    {
      creator: TiktokCreatorDetail;
      videos: TiktokVideoTimelineByHashtag[];
    }
  > = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: 6,
    puppeteer,
    puppeteerOptions: {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
    retryLimit: 3,
    retryDelay: 1000,
    timeout: 60000,
    ...clusterOptions,
  });

  const creatorData: {
    creator: TiktokCreatorDetail;
    videos: TiktokVideoTimelineByHashtag[];
  }[] = [];

  let tryCount = 0;
  for (let i = 0; i < videoByHashtags.length; i++) {
    try {
      const creator = await cluster.execute(
        { video: videoByHashtags[i] },
        getCreatorData,
      );
      console.log(
        `getCreatorData @${videoByHashtags[i].author.uniqueId} complete, got ${creator.videos.length} videos`,
      );
      creatorData.push(creator);
      tryCount = 0;
    } catch (error: any) {
      if (tryCount < maxRetryEachVideo - 1) {
        console.log(
          `getCreatorData @${videoByHashtags[i].author.uniqueId} error (${tryCount + 1}) reason: ${error.message}. Retrying...`,
        );
        tryCount++;
        i--;
        continue;
      } else {
        console.log(
          `getCreatorData @${videoByHashtags[i].author.uniqueId} error (${tryCount + 1}) reason: ${error.message}. Skipping...`,
        );
        console.log(error);
        tryCount = 0;
      }
    }
  }

  await cluster.idle();
  await cluster.close();

  return creatorData;
}
