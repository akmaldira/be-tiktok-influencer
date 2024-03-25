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
      throw new Error(`Website is loading, please wait...`);
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
  if (page.isClosed()) {
    console.log("Page is closed");
    page = await page.browser().newPage();
  }
  if (!page.browser().connected) {
    throw new Error("Browser is disconnected");
  }

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  );

  const [creatorDataResponse, latestVideos] = await Promise.all([
    page.waitForResponse(async (res) => {
      const url = res.url();
      const status = res.status();
      return (
        url.includes(`https://www.tiktok.com/@${data.video.author.uniqueId}`) &&
        status === 200
      );
    }),
    page.waitForResponse((res) => {
      const url = res.url();
      const status = res.status();
      return (
        url.includes(`https://www.tiktok.com/api/post/item_list`) &&
        status === 200
      );
    }),
    page.goto(`https://www.tiktok.com/@${data.video.author.uniqueId}`),
  ]);
  const html = await creatorDataResponse.text();
  const creator = extractCreatorDataFromHTML(html);

  const videos: TiktokVideosByHashtagResponse = await latestVideos.json();
  const videoList = extractCreatorVideosFromJSON(videos);
  console.log(
    `getCreatorData @${data.video.author.uniqueId} complete, got ${videoList.length} videos`,
  );
  globalCreatorData.push({
    creator: creator,
    videos: videoList,
  });
  await page.close();
}

let globalCreatorData: {
  creator: {
    user: TiktokCreatorDetail;
    stats: TiktokVideoStats;
  };
  videos: TiktokVideoTimelineByHashtag[];
}[] = [];
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
  globalCreatorData = [];
  puppeteer.use(StealthPlugin());
  const cluster: Cluster<{ video: TiktokVideoTimelineWithHashtag }, void> =
    await Cluster.launch({
      concurrency: Cluster.CONCURRENCY_PAGE,
      maxConcurrency: 3,
      puppeteer,
      puppeteerOptions: {
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-features=site-per-process",
        ],
      },
      retryLimit: maxRetryEachVideo,
      retryDelay: 5000,
      timeout: 60000,
      ...clusterOptions,
    });

  cluster.on(
    "taskerror",
    async (
      err: any,
      data: { video: TiktokVideoTimelineWithHashtag },
      retry: boolean,
    ) => {
      if (retry) {
        if (err.message == "Website is loading, please wait...") {
          console.log(
            `getCreatorData @${data.video.author.uniqueId} error reason: Website is loading. Retrying...`,
          );

          return;
        }
        console.log(
          `getCreatorData @${data.video.author.uniqueId} error reason: ${err.message}. Retrying...`,
        );
        return;
      }
      console.log(
        `getCreatorData @${data.video.author.uniqueId} error reason: ${err.message}. Skipping...`,
      );
    },
  );
  for (let i = 0; i < videoByHashtags.length; i++) {
    cluster.queue({ video: videoByHashtags[i] }, getCreatorData);
  }

  await cluster.idle();
  await cluster.close();

  return globalCreatorData;
}
