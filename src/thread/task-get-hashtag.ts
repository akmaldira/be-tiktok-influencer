import axios from "axios";
import { Page } from "puppeteer";
import { Cluster } from "puppeteer-cluster";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import TiktokCountryEntity from "../database/entities/tiktok-country.entity";
import TiktokIndustryEntity from "../database/entities/tiktok-industry.entity";
import { PopularHashtag, TiktokPopularHashtagResponse } from "./tiktok-types";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getPopularHashtags({
  page,
  data: { country, industry },
}: {
  page: Page;
  data: { country: TiktokCountryEntity; industry: TiktokIndustryEntity };
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

  const [request] = await Promise.all([
    page.waitForRequest(
      (req) => {
        return req
          .url()
          .includes(
            "https://ads.tiktok.com/creative_radar_api/v1/popular_trend/creator/list",
          );
      },
      {
        timeout: 15000,
      },
    ),
    page.goto(
      `https://ads.tiktok.com/business/creativecenter/inspiration/popular/creator/pc/en`,
    ),
  ]);

  const headers = request.headers();
  if (
    !headers.timestamp ||
    !headers["user-sign"] ||
    !headers["anonymous-user-id"]
  ) {
    throw new Error(`getHeaders error reason: missing required headers`);
  }

  const hashtags = await fetchPopularHashtag({
    headers: {
      timestamp: headers.timestamp,
      userSign: headers["user-sign"],
      anonymousUserId: headers["anonymous-user-id"],
    },
    country,
    industry,
  });

  globalHashtags.push(...hashtags);
  await page.close();
}

async function fetchPopularHashtag({
  headers,
  country,
  industry,
}: {
  headers: { timestamp: string; userSign: string; anonymousUserId: string };
  country: TiktokCountryEntity;
  industry: TiktokIndustryEntity;
  retry?: number;
}) {
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
  if (resData && resData.msg == "no permission") {
    throw new Error(`getPopularHashtags error reason: no permission`);
  }
  if (!resData || resData.code != 0) {
    throw new Error(`getPopularHashtags error reason: invalid response data`);
  }

  const data = resData.data as TiktokPopularHashtagResponse;
  const distinctHashtagsList = data.list.filter(
    (v, i, a) => a.findIndex((t) => t.hashtag_name === v.hashtag_name) === i,
  );
  console.log(
    `getPopularHashtags industry: ${industry.value} got ${distinctHashtagsList.length} hashtags`,
  );
  return distinctHashtagsList;
}

let globalHashtags: PopularHashtag[] = [];
export default async function taskGetHashtags(
  country: TiktokCountryEntity,
  industries: TiktokIndustryEntity[],
  clusterOptions: {
    maxConcurrency?: number;
    retryLimit?: number;
    retryDelay?: number;
    timeout?: number;
  } = {},
  maxRetryEachIndustry: number = 3,
) {
  globalHashtags = [];
  puppeteer.use(StealthPlugin());
  const cluster: Cluster<
    { country: TiktokCountryEntity; industry: TiktokIndustryEntity },
    void
  > = await Cluster.launch({
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
    retryLimit: maxRetryEachIndustry,
    retryDelay: 5000,
    timeout: 60000,
    ...clusterOptions,
  });

  cluster.on(
    "taskerror",
    async (
      err,
      data: { country: TiktokCountryEntity; industry: TiktokIndustryEntity },
      retry: boolean,
    ) => {
      if (retry) {
        console.log(
          `getPopularHashtags industry: ${data.industry.value} error reason: ${err.message}. Retrying...`,
        );
        return;
      }
      if (err.message == "getPopularHashtags error reason: no permission") {
        console.log(
          `getPopularHashtags industry: ${data.industry.value} error reason: no permission. Wait 5s...`,
        );
        await sleep(5000);
        cluster.queue(
          { country: data.country, industry: data.industry },
          getPopularHashtags,
        );
        return;
      }
      console.log(
        `getPopularHashtags industry: ${data.industry.value} error reason: ${err.message}. Skipping...`,
      );
    },
  );

  for (let i = 0; i < industries.length; i++) {
    cluster.queue({ country, industry: industries[i] }, getPopularHashtags);
  }

  await cluster.idle();
  await cluster.close();

  return globalHashtags;
}
