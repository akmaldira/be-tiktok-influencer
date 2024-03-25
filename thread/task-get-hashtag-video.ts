import { Page } from "puppeteer";
import { Cluster } from "puppeteer-cluster";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import TiktokHelper from "./tiktok-helper";
import {
  PopularHashtag,
  TiktokVideoTimelineWithHashtag,
  TiktokVideosByHashtagResponse,
} from "./tiktok-types";

async function getVideoByHashtag({
  page,
  data,
}: {
  page: Page;
  data: { hashtag: PopularHashtag };
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
  await page.goto(
    `https://www.tiktok.com/tag/${data.hashtag.hashtag_name}?lang=en,`,
  );

  const videoListResponse = await page.waitForResponse(
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

  const response: TiktokVideosByHashtagResponse =
    await videoListResponse.json();

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

  const videoListWithHashtag = distinctVideosAuthor.map((v) => ({
    ...v,
    hashtag: data.hashtag,
  })) as TiktokVideoTimelineWithHashtag[];

  console.log(
    `getVideoByHashtag #${data.hashtag.hashtag_name} complete, got ${videoListWithHashtag.length} videos`,
  );

  globalVideo.push(...videoListWithHashtag);
  await page.close();
}

let globalVideo: TiktokVideoTimelineWithHashtag[] = [];
export default async function taskGetVideoByHashtag(
  hashtags: PopularHashtag[],
  clusterOptions: {
    maxConcurrency?: number;
    retryLimit?: number;
    retryDelay?: number;
    timeout?: number;
  } = {},
  maxRetryEachHashtag: number = 3,
) {
  globalVideo = [];
  puppeteer.use(StealthPlugin());
  const cluster: Cluster<{ hashtag: PopularHashtag }, void> =
    await Cluster.launch({
      concurrency: Cluster.CONCURRENCY_PAGE,
      maxConcurrency: 6,
      puppeteer,
      puppeteerOptions: {
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-features=site-per-process",
        ],
      },
      retryLimit: maxRetryEachHashtag,
      retryDelay: 1000,
      timeout: 60000,
      ...clusterOptions,
    });

  cluster.on(
    "taskerror",
    (err, data: { hashtag: PopularHashtag }, retry: boolean) => {
      if (retry) {
        console.log(
          `getVideoByHashtag #${data.hashtag.hashtag_name} error reason: ${err.message}. Retrying...`,
        );
        return;
      }
      console.log(
        `getVideoByHashtag #${data.hashtag.hashtag_name} error reason: ${err.message}. Skipping...`,
      );
    },
  );

  for (let i = 0; i < hashtags.length; i++) {
    cluster.queue({ hashtag: hashtags[i] }, getVideoByHashtag);
  }

  await cluster.idle();
  await cluster.close();

  const distinctVideos = globalVideo.filter((v, i, a) => {
    return a.findIndex((t) => t.id === v.id) === i;
  });

  return distinctVideos;
}
