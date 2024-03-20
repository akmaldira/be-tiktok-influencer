import axios, { AxiosHeaders, RawAxiosRequestHeaders } from "axios";
import fs from "fs";
import path from "path";
import { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import dataSource from "../src/database/data-source";
import TiktokCountryEntity from "../src/database/entities/tiktok-country.entity";
import TiktokHashtagEntity from "../src/database/entities/tiktok-hashtag.entity";
import TiktokIndustryEntity from "../src/database/entities/tiktok-industry.entity";
import {
  CreatorDetailResponse,
  GetCreatorDetailByVideoAuthorProps,
  GetHashtagFilterFromTiktokResponse,
  GetManyVideosByManyHashtagProps,
  GetPopularHashtagProps,
  GetPopularHashtagResponse,
  SetDefaultHeadersProps,
  TiktokSyncHelperProps,
  VideoAuthor,
} from "./types";

export class Logger {
  private workerName: string;
  private filePath: string;
  private logStream: any;
  private saveLog: boolean;

  constructor(workerName: string, saveLog = false, filePath?: string) {
    this.workerName = workerName;
    this.saveLog = saveLog;
    if (saveLog) {
      const today = new Date().toISOString().split("T")[0];
      this.filePath =
        filePath || path.resolve("sync-logs", `${workerName}-${today}.log`);
      this.logStream = fs.createWriteStream(this.filePath, { flags: "a" });
    }
  }

  log(message: string) {
    if (this.saveLog) {
      this.logStream.write(`[${this.workerName}] ${message}\n`);
    }
    console.log(`[${this.workerName}] ${message}`);
  }

  error(error: Error | any | unknown, message?: string) {
    if (this.saveLog) {
      this.logStream.write(
        `[${this.workerName}] ${message || error.message}\n${error.stack}\n`,
      );
    }
    console.error(
      `[${this.workerName}] ${message || error.message}\n${error.stack}`,
    );
  }
}

export default class TiktokSyncHelper {
  public logger: Logger;
  public maxTryCount: number;
  public maxTryCountInitialHeaders: number;
  public workerName: string;
  public browser: Browser | undefined;
  public onGetInitialHeadersMaxTry: TiktokSyncHelperProps["onGetInitialHeadersMaxTry"];
  public defaultHeaders: RawAxiosRequestHeaders | AxiosHeaders = {
    Accept: "application/json, text/plain, /",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  };

  constructor({
    saveLog = true,
    workerName,
    maxTryCount = 3,
    maxTryCountInitialHeaders = 5,
    onGetInitialHeadersMaxTry,
  }: TiktokSyncHelperProps) {
    this.workerName = workerName;
    this.logger = new Logger(workerName, saveLog);
    this.maxTryCount = maxTryCount - 1;
    this.maxTryCountInitialHeaders = maxTryCountInitialHeaders - 1;
    this.onGetInitialHeadersMaxTry = onGetInitialHeadersMaxTry;
    puppeteer.use(StealthPlugin());
  }

  public setDefaultHeaders({
    anonymousUserId,
    timeStamp,
    userSign,
  }: SetDefaultHeadersProps) {
    this.defaultHeaders["Anonymous-User-Id"] = anonymousUserId;
    this.defaultHeaders["Timestamp"] = timeStamp;
    this.defaultHeaders["User-Sign"] = userSign;
    return this.defaultHeaders;
  }

  public resetDefaultHeaders() {
    this.defaultHeaders["Anonymous-User-Id"] = undefined;
    this.defaultHeaders["Timestamp"] = undefined;
    this.defaultHeaders["User-Sign"] = undefined;
    return this.defaultHeaders;
  }

  public async openBrowser(deleteAllTab = true) {
    if (this.browser) {
      if (deleteAllTab) {
        const tabs = await this.browser.pages();
        await Promise.all(tabs.map((tab) => tab.close()));
      }
      return this.browser;
    }
    this.browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    return this.browser;
  }

  public async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
    }
  }

  async getInitialHeaders({
    tryCount = 0,
  } = {}): Promise<RawAxiosRequestHeaders | void> {
    const browser = await this.openBrowser();
    try {
      this.logger.log("Getting initial headers...");
      const page = await browser.newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      );
      await page.goto(
        `https://ads.tiktok.com/business/creativecenter/inspiration/popular/creator/pc/en`,
      );
      await page.reload();

      const request = await page.waitForRequest((request) => {
        return request
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
        throw new Error("Headers not found");
      }

      await this.closeBrowser();
      return this.setDefaultHeaders({
        timeStamp: headers?.timestamp,
        userSign: headers?.["user-sign"],
        anonymousUserId: headers?.["anonymous-user-id"],
      });
    } catch (error: any) {
      if (tryCount < this.maxTryCountInitialHeaders) {
        this.logger.error(
          error,
          `Error getting initial headers. Retry count ${tryCount + 1}. Retrying...`,
        );
        return this.getInitialHeaders({ tryCount: tryCount + 1 });
      }
      await this.closeBrowser();
      this.logger.error(
        error,
        `Error getting initial headers. Max retries reached (${tryCount + 1}). exiting...`,
      );
      if (this.onGetInitialHeadersMaxTry) {
        return this.onGetInitialHeadersMaxTry(error);
      } else {
        process.exit(1);
      }
    }
  }

  async getPopularHashtags({
    tryCount = 0,
    filter,
  }: GetPopularHashtagProps): Promise<GetPopularHashtagResponse> {
    try {
      if (this.defaultHeaders["Anonymous-User-Id"] === undefined) {
        await this.getInitialHeaders();
      }

      this.logger.log(
        `Getting popular hashtags on country ${filter.country_code}, industry ${filter.industry_id}, page ${filter.page}...`,
      );
      const searchParams = new URLSearchParams({
        page: filter.page.toString(),
        limit: filter.limit.toString(),
        period: filter.period.toString(),
        country_code: filter.country_code,
        industry_id: filter.industry_id,
        sort_by: filter.sort_by,
      });

      const res = await axios.get(
        `https://ads.tiktok.com/creative_radar_api/v1/popular_trend/hashtag/list?${searchParams.toString()}`,
        {
          headers: this.defaultHeaders,
        },
      );

      const resData = res.data;

      if (resData.code !== 0) {
        if (resData.msg == "no permission") {
          this.resetDefaultHeaders();
        }
        throw new Error(resData.msg);
      }

      return resData.data;
    } catch (error) {
      if (tryCount < this.maxTryCount) {
        this.logger.error(
          error,
          `Error getting popular hashtags. Retry count ${tryCount + 1}. Retrying...`,
        );
        return this.getPopularHashtags({ tryCount: tryCount + 1, filter });
      }
      this.logger.error(
        error,
        `Error getting popular hashtags. Max retries reached (${tryCount + 1}). Skipping...`,
      );
      return { list: [], pagination: {} };
    }
  }

  async getAllPopularHashtags({ filter }: GetPopularHashtagProps) {
    const hashtagsList: Partial<TiktokHashtagEntity>[] = [];
    let loop = true;
    while (loop) {
      const { list, pagination } = await this.getPopularHashtags({
        filter: filter,
      });

      loop = pagination.has_more;
      if (list.length == 0 || pagination.has_more == undefined) {
        loop = false;
      }
      filter.page++;

      for (const hashtag of list) {
        if (!hashtagsList.find((h) => h.name == hashtag.hashtag_name)) {
          hashtagsList.push({
            id: hashtag.hashtag_id,
            name: hashtag.hashtag_name,
            isPromoted: hashtag.is_promoted,
            publishCount: hashtag.publish_cnt,
            videoViews: hashtag.video_views,
            trend: hashtag.trend,
            country: {
              id: filter.country_code,
            } as TiktokCountryEntity,
            industry: {
              id: filter.industry_id,
            } as TiktokIndustryEntity,
          });
        }
      }
    }
    return hashtagsList;
  }

  async getAllVideosByManyHashtag({
    hashtags,
    country,
    industry,
  }: GetManyVideosByManyHashtagProps): Promise<VideoAuthor[]> {
    const creatorsTempData: VideoAuthor[] = [];
    const browser = await this.openBrowser();
    let page: Page | undefined = undefined;

    let tryCountEachIteration = 0;
    for (let i = 0; i < hashtags.length; i++) {
      const hashtag = hashtags[i];
      try {
        this.logger.log(
          `Getting video list on country ${country.id} by hashtag ${hashtag}...`,
        );
        if (!page) {
          page = await browser.newPage();
        }
        await page.setUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        );
        await page.goto(
          `https://ads.tiktok.com/business/creativecenter/hashtag/${hashtag}/pc/en?countryCode=${country.id}&period=7`,
        );

        const videoList = await page.waitForResponse((response) => {
          const url = response.url();
          const status = response.status();

          return (
            url.includes("https://www.tiktok.com/api/recommend/embed_videos") &&
            status === 200
          );
        });
        const creatorData = await videoList.json();

        const authors = creatorData.items.map((video: any) => ({
          uniqueId: video.author.uniqueId,
          country: country,
          hashtag: hashtag,
        })) as VideoAuthor[];
        const set = new Set();
        const distinctAuthors = authors.filter((author: any) => {
          const duplicate = set.has(author.uniqueId);
          set.add(author.uniqueId);
          return !duplicate;
        });

        this.logger.log(
          `Got ${distinctAuthors.length} authors on hashtag ${hashtag} [${distinctAuthors.map((author) => author.uniqueId).join(", ")}]`,
        );
        creatorsTempData.push(...distinctAuthors);
        await page.close();
        page = undefined;
        if (tryCountEachIteration > 0) {
          tryCountEachIteration = 0;
        }
      } catch (error) {
        if (page) {
          await page.close();
          page = undefined;
        }
        if (tryCountEachIteration < this.maxTryCount) {
          this.logger.error(
            error,
            `Error getting video list by hashtag ${hashtag}. Retry count ${tryCountEachIteration + 1}. Retrying...`,
          );
          tryCountEachIteration++;
          i--;
          continue;
        }
        this.logger.error(
          error,
          `Error getting video list by hashtag ${hashtag}. Max retries reached (${tryCountEachIteration + 1}). Skipping...`,
        );
        tryCountEachIteration = 0;
      }
    }

    await this.closeBrowser();
    const set = new Set();
    const distinctCreatorsTempData = creatorsTempData.filter((author: any) => {
      const duplicate = set.has(author.uniqueId);
      set.add(author.uniqueId);
      return !duplicate;
    });

    this.logger.log(
      `Got ${distinctCreatorsTempData.length} unique authors on industry ${industry.value}`,
    );

    return distinctCreatorsTempData;
  }

  async getCreatorDetailByVideoAuthor({
    author,
    tryCount = 0,
  }: GetCreatorDetailByVideoAuthorProps): Promise<
    CreatorDetailResponse | undefined
  > {
    try {
      const tiktokUrl = `https://www.tiktok.com/@${author.uniqueId}`;
      const res = await axios.get(tiktokUrl);
      const tempData = res.data.match(
        /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"([^>]+)>([^<]+)<\/script>/,
      );
      if (!tempData) {
        throw new Error("No data found");
      }
      const jsonData = JSON.parse(tempData[2]) as any;
      const creatorDetail = jsonData["__DEFAULT_SCOPE__"]["webapp.user-detail"];
      const userInfo = creatorDetail.userInfo as
        | CreatorDetailResponse
        | undefined;

      if (!userInfo || !userInfo.user || !userInfo.stats) {
        return undefined;
      }
      this.logger.log(`Got creator detail by video author @${author.uniqueId}`);

      return userInfo;
    } catch (error) {
      if (tryCount < this.maxTryCount) {
        this.logger.error(
          error,
          `Error getting creator detail by video author ${author.uniqueId}. Retry count ${tryCount + 1}. Retrying...`,
        );
        return this.getCreatorDetailByVideoAuthor({
          author,
          tryCount: tryCount + 1,
        });
      }
      this.logger.error(
        error,
        `Error getting creator detail by video author ${author.uniqueId}. Max retries reached (${tryCount + 1}). Skipping...`,
      );
      return undefined;
    }
  }

  async getHashtagFilterFromTiktok({
    tryCount = 0,
  } = {}): Promise<GetHashtagFilterFromTiktokResponse> {
    try {
      if (this.defaultHeaders["Anonymous-User-Id"] === undefined) {
        await this.getInitialHeaders();
      }

      const res = await axios.get(
        `https://ads.tiktok.com/creative_radar_api/v1/popular_trend/hashtag/filters`,
        {
          headers: this.defaultHeaders,
        },
      );

      const resData = res.data;

      if (resData.code !== 0) {
        throw new Error(resData.msg);
      }

      return resData.data;
    } catch (error) {
      if (tryCount < this.maxTryCount) {
        this.logger.error(
          error,
          `Error getting hashtag filter. Retry count ${tryCount + 1}. Retrying...`,
        );
        return this.getHashtagFilterFromTiktok({ tryCount: tryCount + 1 });
      }
      this.logger.error(
        error,
        `Error getting hashtag filter. Max retries reached (${tryCount + 1}). Exiting...`,
      );
      process.exit(1);
    }
  }

  public static async saveHashtagFilterToDb() {
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }

    const helper = new TiktokSyncHelper({
      workerName: "hashtag-filter",
      saveLog: false,
    });

    const filter = await helper.getHashtagFilterFromTiktok();

    await TiktokCountryEntity.upsert(filter.country, {
      conflictPaths: ["id"],
    });
    await TiktokIndustryEntity.upsert(filter.industry, {
      conflictPaths: ["id"],
    });
  }

  public static getCreatorInfoFromUserDetail({
    user,
  }: {
    user: CreatorDetailResponse["user"];
  }) {
    let email: string | null = null;
    const phone: string | null = null;
    const instagram: string | null = null;

    const matchEmails = user.signature?.matchAll(
      /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g,
    );
    if (matchEmails) {
      email = Array.from(matchEmails, (match) => match[0]).join(", ");
    }

    // const matchPhones = user.signature?.matchAll(
    //   /\+?([ -]?\d+)+|\(\d+\)([ -]\d+)/g,
    // );
    // if (matchPhones) {
    //   phone = Array.from(matchPhones, (match) => match[0]).join(", ");
    // }

    // const matchInstagram = user.signature?.match(
    //   /(?<=[^\/]|^)(@|ig:\s+|ig\s+:\s+|instagram\s+|ig\s+)[A-Za-z0-9_.]{3,25}/,
    // );
    // if (matchInstagram) {
    //   instagram = matchInstagram[0].split(" ")[1] || null;
    // }

    return {
      email,
      phone,
      instagram,
    };
  }
}
