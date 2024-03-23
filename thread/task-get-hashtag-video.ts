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
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  );
  await page.goto(
    `https://www.tiktok.com/tag/${data.hashtag.hashtag_name}?lang=en,`,
  );

  const videoListResponse = await page.waitForResponse(async (res) => {
    const url = res.url();
    const status = res.status();
    return (
      url.includes("https://www.tiktok.com/api/challenge/item_list") &&
      status === 200
    );
  });

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

  return videoListWithHashtag;
}

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
  puppeteer.use(StealthPlugin());
  const cluster: Cluster<
    { hashtag: PopularHashtag },
    TiktokVideoTimelineWithHashtag[]
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

  const videoListByHashtag: TiktokVideoTimelineWithHashtag[] = [];

  let tryCount = 0;
  for (let i = 0; i < hashtags.length; i++) {
    try {
      const videoByHashtagResponse = await cluster.execute(
        { hashtag: hashtags[i] },
        getVideoByHashtag,
      );
      console.log(
        `getVideoByHashtag #${hashtags[i].hashtag_name} complete, got ${videoByHashtagResponse.length} videos`,
      );
      videoListByHashtag.push(...videoByHashtagResponse);
      tryCount = 0;
    } catch (error: any) {
      if (tryCount < maxRetryEachHashtag - 1) {
        console.log(
          `getVideoByHashtag #${hashtags[i].hashtag_name} error (${tryCount + 1}) reason: ${error.message}. Retrying...`,
        );
        tryCount++;
        i--;
        continue;
      } else {
        console.log(
          `getVideoByHashtag #${hashtags[i].hashtag_name} error (${tryCount + 1}) reason: ${error.message}. Skipping...`,
        );
        console.log(error);
        tryCount = 0;
      }
    }
  }

  await cluster.idle();
  await cluster.close();

  const distinctVideos = videoListByHashtag.filter((v, i, a) => {
    return a.findIndex((t) => t.id === v.id) === i;
  });
  return distinctVideos;
}
