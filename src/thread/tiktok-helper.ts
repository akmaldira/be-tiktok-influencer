import axios, { AxiosHeaders } from "axios";
import fs from "fs";
import path from "path";
import { Browser, TimeoutError } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import dataSource from "../database/data-source";
import TiktokCountryEntity from "../database/entities/tiktok-country.entity";
import TiktokHashtagEntity from "../database/entities/tiktok-hashtag.entity";
import TiktokIndustryEntity from "../database/entities/tiktok-industry.entity";
import {
  TiktokCreatorDetail,
  TiktokCreatorDetailAndVideosProps,
  TiktokCreatorVideo,
  TiktokCredentials,
  TiktokFilterResponse,
  TiktokHelperConstructor,
  TiktokPopularHashtagProps,
  TiktokPopularHashtagResponse,
  TiktokVideoDetailProps,
  TiktokVideoTimelineByHashtag,
  TiktokVideosByHashtagProps,
  TiktokVideosByHashtagResponse,
} from "./tiktok-types";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
      const folderPath = path.resolve("sync-logs", today);
      this.filePath = filePath || path.join(folderPath, `${workerName}.log`);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
      }
      this.logStream = fs.createWriteStream(this.filePath, { flags: "a" });
    }
  }

  log(message: string) {
    const today = new Intl.DateTimeFormat("en", {
      timeStyle: "medium",
    }).format(new Date());
    if (this.saveLog) {
      this.logStream.write(`[${today}][${this.workerName}] ${message}\n`);
    }
    console.log(`[${today}][${this.workerName}] ${message}`);
  }

  error(error: Error | any | unknown, message?: string) {
    const today = new Intl.DateTimeFormat("en", {
      timeStyle: "medium",
    }).format(new Date());
    if (this.saveLog) {
      this.logStream.write(
        `[${today}][${this.workerName}] ${message || error.message}\n${error.stack}\n`,
      );
    }
    if (
      error instanceof TimeoutError ||
      error instanceof Error ||
      error.message == "no permission"
    ) {
      console.error(
        `[${today}][${this.workerName}] ${message || error.message}`,
      );
      return;
    }
    console.error(
      `[${today}][${this.workerName}] ${message || error.message}\n${error.stack}`,
    );
  }
}

export default class TiktokHelper {
  public logger: Logger;
  public maxTry: number;
  public maxTryInitialHeader: number;
  public workerName: string;
  public tiktokReqHeader: AxiosHeaders = new AxiosHeaders();
  public browser: Browser | undefined;
  public onInitialHeaderMaxTry: (error: Error) => void;
  public defaultWaitForNetworkTimeOut: number = 15000;

  constructor({
    saveLog = true,
    workerName,
    maxTry = 3,
    maxTryInitialHeader = 5,
    onInitialHeaderMaxTry,
  }: TiktokHelperConstructor) {
    this.logger = new Logger(workerName, saveLog);
    this.maxTry = maxTry - 1;
    this.maxTryInitialHeader = maxTryInitialHeader - 1;
    this.workerName = workerName;
    this.onInitialHeaderMaxTry =
      onInitialHeaderMaxTry ||
      (() => {
        throw new Error(
          `ERROR: onInitialHeaderMaxTry, reason: max try count reached`,
        );
      });
    this.tiktokReqHeader.set("Accept", "application/json, text/plain, /", true);
    this.tiktokReqHeader.set(
      "User-Agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      true,
    );
    puppeteer.use(StealthPlugin());
    process.on("SIGINT", async () => {
      await this.exitBrowser();
      process.exit(0);
    });
  }

  public setDefaultHeader({
    Timestamp,
    "Anonymous-User-Id": AnonymousUserId,
    "User-Sign": UserSign,
  }: TiktokCredentials) {
    this.tiktokReqHeader.set("Anonymous-User-Id", AnonymousUserId, true);
    this.tiktokReqHeader.set("Timestamp", Timestamp);
    this.tiktokReqHeader.set("User-Sign", UserSign);
  }

  public resetDefaultHeader() {
    this.tiktokReqHeader.delete("Anonymous-User-Id");
    this.tiktokReqHeader.delete("Timestamp");
    this.tiktokReqHeader.delete("User-Sign");
  }

  public async getBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-features=site-per-process",
        ],
      });
    }
    this.browser.on("disconnected", () => {
      this.logger.log("INFO: browser disconnected");
      if (this.browser) {
        const process = this.browser.process();
        if (process) {
          process.kill("SIGINT");
        }
      }
      this.browser = undefined;
    });
    return this.browser;
  }

  public async exitBrowser() {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = undefined;
      }
    } catch (error) {
      this.logger.error(
        error,
        "ERROR: exitBrowser, reason: error closing browser",
      );
      this.browser = undefined;
    }
  }

  public async getAndSetTiktokRequestHeader({
    tryCount = 0,
  } = {}): Promise<void> {
    const browser = await this.getBrowser();
    try {
      this.logger.log("INFO: getting initial headers...");
      const page = await browser.newPage();
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
        { timeout: this.defaultWaitForNetworkTimeOut },
      );

      const headers = request.headers();
      if (
        !headers.timestamp ||
        !headers["user-sign"] ||
        !headers["anonymous-user-id"]
      ) {
        await this.exitBrowser();
        throw new Error(
          `ERROR: getAndSetTiktokRequestHeader, reason: missing required headers`,
        );
      }

      this.tiktokReqHeader.set("Timestamp", headers.timestamp);
      this.tiktokReqHeader.set("User-Sign", headers["user-sign"]);
      this.tiktokReqHeader.set(
        "Anonymous-User-Id",
        headers["anonymous-user-id"],
      );

      await this.exitBrowser();
    } catch (error: any) {
      await this.exitBrowser();
      if (tryCount < this.maxTryInitialHeader) {
        this.logger.error(
          error,
          `ERROR (${tryCount + 1}): getAndSetTiktokRequestHeader, reason: ${error.message}. retrying...`,
        );
        return this.getAndSetTiktokRequestHeader({ tryCount: tryCount + 1 });
      }
      return this.onInitialHeaderMaxTry(error);
    }
  }

  public async getPopularHashtagFromTiktok({
    tryCount = 0,
    filter,
  }: TiktokPopularHashtagProps): Promise<
    TiktokPopularHashtagResponse | undefined
  > {
    try {
      if (
        !this.tiktokReqHeader.has("Anonymous-User-Id") ||
        !this.tiktokReqHeader.has("Timestamp") ||
        !this.tiktokReqHeader.has("User-Sign")
      ) {
        await this.getAndSetTiktokRequestHeader();
      }

      this.logger.log(
        `INFO: getting popular hashtag on country ${filter.country_code}, industry ${filter.industry_id}, page ${filter.page}...`,
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
          headers: this.tiktokReqHeader,
        },
      );

      const resData = res.data;

      if (resData.code != 0) {
        if (resData.msg == "no permission") {
          this.resetDefaultHeader();
        }
        throw new Error(resData.msg);
      }

      return resData.data as TiktokPopularHashtagResponse;
    } catch (error: any) {
      if (tryCount < this.maxTry) {
        this.logger.error(
          error,
          `ERROR (${tryCount + 1}): getPopularHashtagFromTiktok, reason: ${error.message}. retrying...`,
        );
        return this.getPopularHashtagFromTiktok({
          tryCount: tryCount + 1,
          filter,
        });
      }
      this.logger.error(
        error,
        `ERROR (${tryCount + 1}): getPopularHashtagFromTiktok, reason: ${error.message}. skipping...`,
      );
      return;
    }
  }

  public async getPopularHashtag({
    filter,
    maxData,
  }: Omit<TiktokPopularHashtagProps, "tryCount"> & {
    maxData?: number;
  }): Promise<Partial<TiktokHashtagEntity>[]> {
    const allHashtags: Partial<TiktokHashtagEntity>[] = [];
    let hasNextPage = true;

    while (hasNextPage) {
      const popularHashtag = await this.getPopularHashtagFromTiktok({
        filter,
      });

      if (!popularHashtag) {
        break;
      }

      hasNextPage = popularHashtag.pagination.has_more;
      filter.page++;

      for (const hashtag of popularHashtag.list) {
        allHashtags.push({
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

      if (maxData && allHashtags.length >= maxData) {
        break;
      }

      await sleep(1000);
    }

    const distinctHashtagsList = allHashtags.filter(
      (v, i, a) => a.findIndex((t) => t.name === v.name) === i,
    );

    return distinctHashtagsList;
  }

  public async getVideosByHashtag({
    hashtag,
    limit = 30,
    tryCount = 0,
  }: TiktokVideosByHashtagProps): Promise<
    TiktokVideosByHashtagResponse["itemList"]
  > {
    const browser = await this.getBrowser();
    try {
      this.logger.log(`INFO: getting videos by hashtag ${hashtag}...`);
      const page = await browser.newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      );

      await page.goto(`https://www.tiktok.com/tag/${hashtag}?lang=en`, {
        timeout: this.defaultWaitForNetworkTimeOut,
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
          timeout: this.defaultWaitForNetworkTimeOut,
        },
      );

      const response: TiktokVideosByHashtagResponse =
        await networkResponse.json();

      await this.exitBrowser();
      return response.itemList;
    } catch (error: any) {
      await this.exitBrowser();
      if (tryCount < this.maxTry) {
        this.logger.error(
          error,
          `ERROR (${tryCount + 1}): getVideosByHashtag (${hashtag}), reason: ${error.message}. retrying...`,
        );
        return this.getVideosByHashtag({
          hashtag,
          limit,
          tryCount: tryCount + 1,
        });
      }
      this.logger.error(
        error,
        `ERROR (${tryCount + 1}): getVideosByHashtag (${hashtag}), reason: ${error.message}. skipping...`,
      );
      return [];
    }
  }

  private parseCreatorDetailFromResponse(
    response: string,
  ): TiktokCreatorDetail | null {
    const tempData = response.match(
      /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"([^>]+)>([^<]+)<\/script>/,
    );
    if (!tempData) {
      return null;
    }
    const jsonData = JSON.parse(tempData[2]) as any;
    const creatorJsonData = jsonData["__DEFAULT_SCOPE__"]["webapp.user-detail"];
    const creatorDetail = creatorJsonData.userInfo.user as TiktokCreatorDetail;

    if (!creatorDetail) {
      throw new Error("No creator data found");
    }
    return creatorDetail;
  }

  public async getCreatorDetailAndVideos({
    uniqueId,
    tryCount = 0,
  }: TiktokCreatorDetailAndVideosProps): Promise<
    | {
        videoRes: TiktokVideosByHashtagResponse[];
        creatorRes: TiktokCreatorDetail;
      }
    | undefined
  > {
    const browser = await this.getBrowser();
    const videosResponseTemp: TiktokVideosByHashtagResponse[] = [];
    let creatorRes: TiktokCreatorDetail | undefined;
    try {
      const data = await new Promise(
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
          const page = await browser.newPage();
          await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          );

          page.on("response", async (res) => {
            const url = res.url();
            const status = res.status();

            if (url.includes(`https://www.tiktok.com/@${uniqueId}`)) {
              const response = await res.text();
              this.logger.log(`INFO: getting creator detail @${uniqueId}...`);
              const creator = this.parseCreatorDetailFromResponse(response);
              if (!creator) {
                reject(new Error("No creator data found"));
                return;
              }
              creatorRes = creator;
            }

            if (
              url.includes("https://www.tiktok.com/api/post/item_list") &&
              status === 200
            ) {
              const response: TiktokVideosByHashtagResponse = await res.json();
              if (
                !videosResponseTemp.find(
                  (vRes) => vRes.cursor === response.cursor,
                )
              ) {
                videosResponseTemp.push(response);
                if (response.hasMore) {
                  this.logger.log(
                    `INFO: creator @${uniqueId} got ${response.itemList.length} videos on cursor ${response.cursor}. scrolling to load more videos...`,
                  );
                  await page.evaluate(() => {
                    window.scrollTo(0, document.body.scrollHeight);
                  });
                  await sleep(1000);
                } else {
                  this.logger.log(
                    `INFO: creator @${uniqueId} got ${response.itemList.length} videos on cursor ${response.cursor}. done...`,
                  );
                  const totalVideo = videosResponseTemp.reduce(
                    (acc, curr) => acc + curr.itemList.length,
                    0,
                  );
                  this.logger.log(
                    `INFO: creator @${uniqueId} got ${totalVideo} videos in total...`,
                  );
                  if (!creatorRes) {
                    reject(new Error("No creator data found"));
                    return;
                  }
                  resolve({
                    creatorRes,
                    videoRes: videosResponseTemp,
                  });
                }
              }
            }
          });

          await page.goto(`https://www.tiktok.com/@${uniqueId}?lang=en`);
        },
      );
      await this.exitBrowser();
      return data;
    } catch (error: any) {
      await this.exitBrowser();
      if (tryCount < this.maxTry) {
        this.logger.error(
          error,
          `ERROR (${tryCount + 1}): getCreatorDetailAndVideos (@${uniqueId}), reason: ${error.message}. retrying...`,
        );
        return this.getCreatorDetailAndVideos({
          uniqueId,
          tryCount: tryCount + 1,
        });
      }
      this.logger.error(
        error,
        `ERROR (${tryCount + 1}): getCreatorDetailAndVideos (@${uniqueId}), reason: ${error.message}. skipping...`,
      );
      return;
    }
  }

  public async getVideoDetail({
    videoId,
    uniqueId,
    tryCount = 0,
  }: TiktokVideoDetailProps): Promise<TiktokCreatorVideo | undefined> {
    try {
      this.logger.log(`INFO: getting video detail @${uniqueId} ${videoId}...`);
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
      if (tryCount < this.maxTry) {
        this.logger.error(
          error,
          `ERROR (${tryCount + 1}): getVideoDetail (@${uniqueId}, ${videoId}), reason: ${error.message}. retrying...`,
        );
        return this.getVideoDetail({
          videoId,
          uniqueId,
          tryCount: tryCount + 1,
        });
      }
      this.logger.error(
        error,
        `ERROR (${tryCount + 1}): getVideoDetail (@${uniqueId}, ${videoId}), reason: ${error.message}. skipping...`,
      );
      return;
    }
  }

  public static getCreatorSocialFromSignature({
    creator,
  }: {
    creator: TiktokVideoTimelineByHashtag["author"];
  }) {
    let email: string | null = null;
    const phone: string | null = null;
    const instagram: string | null = null;

    if (!creator || !creator.signature) return { email, phone, instagram };

    const matchEmails = creator.signature.matchAll(
      /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g,
    );
    if (matchEmails) {
      email = Array.from(matchEmails, (match) => match[0]).join(", ");
    }

    if (email?.trim() == "" || email?.length == 0) {
      email = null;
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

  public async getHashtagFilterFromTiktok({
    tryCount = 0,
  } = {}): Promise<TiktokFilterResponse> {
    try {
      if (
        !this.tiktokReqHeader.has("Anonymous-User-Id") ||
        !this.tiktokReqHeader.has("Timestamp") ||
        !this.tiktokReqHeader.has("User-Sign")
      ) {
        await this.getAndSetTiktokRequestHeader();
      }

      const res = await axios.get(
        `https://ads.tiktok.com/creative_radar_api/v1/popular_trend/hashtag/filters`,
        {
          headers: this.tiktokReqHeader,
        },
      );

      const resData = res.data;

      if (resData.code !== 0) {
        throw new Error(resData.msg);
      }

      return resData.data;
    } catch (error: any) {
      if (tryCount < this.maxTry) {
        this.logger.error(
          error,
          `ERROR (${tryCount + 1}): getHashtagFilterFromTiktok, reason: ${error.message}. retrying...`,
        );
        return this.getHashtagFilterFromTiktok({ tryCount: tryCount + 1 });
      }
      this.logger.error(
        error,
        `ERROR (${tryCount + 1}): getHashtagFilterFromTiktok, reason: ${error.message}. skipping...`,
      );
      process.exit(1);
    }
  }

  public static async saveHashtagFilterToDb() {
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }

    const helper = new this({
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

  public static getStats({
    stats,
    statsV2,
  }: {
    stats: TiktokVideoTimelineByHashtag["stats"];
    statsV2: TiktokVideoTimelineByHashtag["statsV2"];
  }) {
    const like = isNaN(parseInt(statsV2.diggCount))
      ? stats.diggCount
      : parseInt(statsV2.diggCount);
    const share = isNaN(parseInt(statsV2.shareCount))
      ? stats.shareCount
      : parseInt(statsV2.shareCount);
    const comment = isNaN(parseInt(statsV2.commentCount))
      ? stats.commentCount
      : parseInt(statsV2.commentCount);
    const view = isNaN(parseInt(statsV2.playCount))
      ? stats.playCount
      : parseInt(statsV2.playCount);
    return { like, share, comment, view };
  }
}

// async function updatePopularHashtag(
//   newHashtags: Partial<TiktokHashtagEntity>[],
// ) {
//   if (!dataSource.isInitialized) {
//     await dataSource.initialize();
//   }

//   const oldPopularHashtag = await TiktokHashtagEntity.find();
//   const newPopularHashtag = newHashtags.map((hashtag) => {
//     const oldHashtag = oldPopularHashtag.find(
//       (old) => old.name === hashtag.name,
//     );
//     if (oldHashtag) {
//       return {
//         ...oldHashtag,
//         ...hashtag,
//         updateCount: oldHashtag.updateCount + 1,
//       };
//     }
//     return hashtag;
//   });

//   await TiktokHashtagEntity.upsert(newPopularHashtag, ["id"]);
// }

// async function getOneIndustry(id: string) {
//   if (!dataSource.isInitialized) {
//     await dataSource.initialize();
//   }
//   return await TiktokIndustryEntity.findOne({
//     where: { id },
//     relations: ["creators"],
//   });
// }

// async function upsertCreatorFromVideo(
//   video: TiktokVideoTimelineByHashtag,
//   industry: TiktokIndustryEntity,
// ) {
//   if (!dataSource.isInitialized) {
//     await dataSource.initialize();
//   }

//   if (!video.author) throw new Error(`Author not found in video ${video.id}`);
//   let creatorEntity = await CreatorEntity.findOne({
//     where: { uniqueId: video.author.uniqueId },
//   });

//   const newSocial = TiktokHelper.getCreatorSocialFromSignature({
//     creator: video.author,
//   });
//   if (!creatorEntity) {
//     creatorEntity = new CreatorEntity();
//     creatorEntity.id = video.author.id;
//     creatorEntity.uniqueId = video.author.uniqueId;
//     creatorEntity.visibility = false;
//     creatorEntity.instagram = newSocial.instagram;
//     creatorEntity.email = newSocial.email;
//     creatorEntity.phone = newSocial.phone;
//     creatorEntity.updateCount = 0;
//   } else {
//     creatorEntity.instagram = newSocial.instagram || creatorEntity.instagram;
//     creatorEntity.email = newSocial.email || creatorEntity.email;
//     creatorEntity.phone = newSocial.phone || creatorEntity.phone;
//     creatorEntity.updateCount = creatorEntity.updateCount += 1;
//   }
//   creatorEntity.nickName = video.author.nickname;
//   creatorEntity.avatar = video.author.avatarThumb;
//   creatorEntity.ttSeller = video.author.ttSeller;
//   creatorEntity.private = video.author.privateAccount;
//   creatorEntity.verified = video.author.verified;
//   creatorEntity.description = video.author.signature
//     ? video.author.signature.length == 0
//       ? null
//       : video.author.signature
//     : null;
//   creatorEntity.followerCount = video.authorStats?.followerCount || null;
//   creatorEntity.likeCount = video.authorStats?.heartCount || null;

//   await creatorEntity.save();

//   industry.creators.push(creatorEntity);
//   await industry.save();
//   return creatorEntity;
// }

// async function updateCreatorData(creator: TiktokCreatorDetail) {
//   if (!dataSource.isInitialized) {
//     await dataSource.initialize();
//   }

//   const creatorEntity = await CreatorEntity.findOne({
//     where: { uniqueId: creator.uniqueId },
//     relations: ["videos"],
//   });

//   if (!creatorEntity) {
//     throw new Error(`Creator @${creator.uniqueId} not found`);
//   }

//   const newSocial = TiktokHelper.getCreatorSocialFromSignature({
//     creator,
//   });

//   creatorEntity.avatar = creator.avatarThumb || creatorEntity.avatar;
//   creatorEntity.language = creator.language;
//   creatorEntity.instagram = newSocial.instagram || creatorEntity.instagram;
//   creatorEntity.email = newSocial.email || creatorEntity.email;
//   creatorEntity.phone = newSocial.phone || creatorEntity.phone;
//   creatorEntity.nickName = creator.nickname || creatorEntity.nickName;
//   creatorEntity.ttSeller = creator.ttSeller || creatorEntity.ttSeller;
//   creatorEntity.private = creator.privateAccount || creatorEntity.private;
//   creatorEntity.verified = creator.verified || creatorEntity.verified;
//   creatorEntity.description = creator.signature || creatorEntity.description;
//   creatorEntity.bioLink = creator.bioLink?.link || creatorEntity.bioLink;
//   creatorEntity.country =
//     ({
//       id: creator.region,
//     } as TiktokCountryEntity) || creatorEntity.country;

//   await creatorEntity.save();
//   return creatorEntity;
// }

// async function upsertCreatorVideos(
//   creator: CreatorEntity,
//   video: TiktokVideoTimelineByHashtag[],
// ) {
//   if (!dataSource.isInitialized) {
//     await dataSource.initialize();
//   }

//   const videosToUpsert = video.map((v) => {
//     const videoEntity = new CreatorVideoEntity();
//     const stats = TiktokHelper.getStats(v);
//     videoEntity.id = v.id;
//     videoEntity.createTime = v.createTime;
//     videoEntity.desc = v.desc;
//     videoEntity.textExtra = v.textExtra;
//     videoEntity.likeCount = stats.like;
//     videoEntity.shareCount = stats.share;
//     videoEntity.commentCount = stats.comment;
//     videoEntity.viewCount = stats.view;
//     videoEntity.collectCount = v.stats.collectCount;
//     videoEntity.creator = creator;
//     return videoEntity;
//   });

//   const upsert = await CreatorVideoEntity.upsert(videosToUpsert, ["id"]);
//   return upsert.identifiers;
// }

// async function updateCreatorVideo(
//   creator: CreatorEntity,
//   video: TiktokCreatorVideo,
// ) {
//   if (!dataSource.isInitialized) {
//     await dataSource.initialize();
//   }

//   const creatorVideo = await CreatorVideoEntity.findOne({
//     where: {
//       id: video.id,
//       creator: {
//         id: creator.id,
//       },
//     },
//   });

//   if (!creatorVideo) {
//     throw new Error(
//       `Video ${video.id} on creator @${creator.uniqueId} not found`,
//     );
//   }

//   // TODO: update video data
//   creatorVideo.suggestedWords = video.suggestedWords;
//   creatorVideo.potentialCategories = video.diversificationLabels;
//   creatorVideo.address = video.contentLocation?.address?.streetAddress || null;

//   await creatorVideo.save();
//   return creatorVideo;
// }
