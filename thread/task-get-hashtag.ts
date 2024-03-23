import axios from "axios";
import { Page } from "puppeteer";
import { Cluster } from "puppeteer-cluster";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import TiktokCountryEntity from "../src/database/entities/tiktok-country.entity";
import TiktokIndustryEntity from "../src/database/entities/tiktok-industry.entity";
import { PopularHashtag, TiktokPopularHashtagResponse } from "./tiktok-types";

async function getHeader({ page }: { page: Page }) {
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  );
  await page.goto(
    `https://ads.tiktok.com/business/creativecenter/inspiration/popular/creator/pc/en`,
  );

  const request = await page.waitForRequest((req) => {
    return req
      .url()
      .includes(
        "https://ads.tiktok.com/creative_radar_api/v1/popular_trend/creator/list",
      );
  });

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

async function getPopularHashtags({
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
  if (!resData || resData.code != 0) {
    throw new Error(`getPopularHashtags error reason: invalid response data`);
  }

  const data = resData.data as TiktokPopularHashtagResponse;
  const distinctHashtagsList = data.list.filter(
    (v, i, a) => a.findIndex((t) => t.hashtag_name === v.hashtag_name) === i,
  );

  return distinctHashtagsList;
}

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
  puppeteer.use(StealthPlugin());
  const cluster: Cluster<
    undefined,
    { timestamp: string; userSign: string; anonymousUserId: string }
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

  const hashtagsData: PopularHashtag[] = [];

  let tryCount = 0;
  for (let i = 0; i < industries.length; i++) {
    try {
      const headers = await cluster.execute(getHeader);

      const hashtags = await getPopularHashtags({
        headers,
        country,
        industry: industries[i],
      });

      hashtagsData.push(...hashtags);
      tryCount = 0;
    } catch (error: any) {
      if (tryCount < maxRetryEachIndustry - 1) {
        console.log(
          `getAndUpdatePopularHashtags industry: ${industries[i].value} error reason: ${error.message}. Retrying...`,
        );
        tryCount++;
        i--;
        continue;
      } else {
        console.log(
          `getAndUpdatePopularHashtags industry: ${industries[i].value} error reason: ${error.message}. Skipping...`,
        );
        console.log(error);
        tryCount = 0;
      }
    }
  }

  await cluster.idle();
  await cluster.close();

  return hashtagsData;
}
