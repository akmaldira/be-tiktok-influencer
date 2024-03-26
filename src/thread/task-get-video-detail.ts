import CreatorVideoEntity from "database/entities/creator-video.entity";
import CreatorEntity from "database/entities/creator.entity";
import { Page } from "puppeteer";
import { Cluster } from "puppeteer-cluster";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { TiktokCreatorVideo } from "./tiktok-types";

function extractVideoDetailFromHTML(html: string) {
  const match = html.match(
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"([^>]+)>([^<]+)<\/script>/,
  );
  if (!match) {
    if (html.includes("Please wait...")) {
      throw new Error(`Website is loading, please wait...`);
    }
    throw new Error(`Cannot find video detail in HTML`);
  }

  const jsonData = JSON.parse(match[2]) as any;
  const videoDetailJsonData =
    jsonData["__DEFAULT_SCOPE__"]["webapp.video-detail"];
  const videoDetail = videoDetailJsonData?.itemInfo?.itemStruct as
    | TiktokCreatorVideo
    | undefined;
  if (!videoDetail) {
    throw new Error(`Cannot find video detail in JSON`);
  }
  return videoDetail;
}

async function getVideoDetail({
  page,
  data,
}: {
  page: Page;
  data: { video: CreatorVideoEntity };
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

  const videoDetailResponse = await page.goto(
    `https://www.tiktok.com/@${data.video.creator.uniqueId}/video/${data.video.id}`,
  );

  // const videoDetailResponse = await page.waitForResponse((response) => {
  //   const url = response.url();
  //   const status = response.status();
  //   console.log(url, status);
  //   return (
  //     url.includes(
  //       `https://www.tiktok.com/@${data.video.creator.uniqueId}/video/${data.video.id}`,
  //     ) && status === 200
  //   );
  // });
  if (!videoDetailResponse) {
    throw new Error(`Cannot get video detail`);
  }

  const html = await videoDetailResponse.text();
  const videoDetail = extractVideoDetailFromHTML(html);
  console.log(
    `getVideoDetail on creator @${data.video.creator.uniqueId} video ${data.video.id} done`,
  );
  globalVideos.push(videoDetail);
  await page.close();
}

let globalVideos: TiktokCreatorVideo[] = [];
export default async function taskGetVideoDetail(
  creator: CreatorEntity,
  clusterOptions: {
    maxConcurrency?: number;
    retryLimit?: number;
    retryDelay?: number;
    timeout?: number;
  } = {},
  maxRetryEachVideo: number = 3,
) {
  globalVideos = [];
  puppeteer.use(StealthPlugin());
  const cluster: Cluster<
    {
      video: CreatorVideoEntity;
    },
    void
  > = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_PAGE,
    maxConcurrency: 3,
    puppeteer,
    puppeteerOptions: {
      headless: false,
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

  cluster.on("taskerror", async (err: any, data: {}, retry: boolean) => {
    if (retry) {
      if (err.message == "Website is loading, please wait...") {
        console.log(
          `getVideoDetail error reason: Website is loading. Retrying...`,
        );
        return;
      }
      console.log(`getVideoDetail error reason: ${err.message}. Retrying...`);
      return;
    }
    console.log(`getVideoDetail error reason: ${err.message}. Skipping...`);
  });

  for (let i = 0; i < creator.videos.length; i++) {
    const video = creator.videos[i];
    video.creator = {
      id: creator.id,
      uniqueId: creator.uniqueId,
    } as CreatorEntity;
    cluster.queue({ video }, getVideoDetail);
  }

  await cluster.idle();
  await cluster.close();

  return globalVideos;
}
