import dataSource from "../database/data-source";
import CreatorVideoEntity from "../database/entities/creator-video.entity";
import CreatorEntity from "../database/entities/creator.entity";
import TiktokCountryEntity from "../database/entities/tiktok-country.entity";
import TiktokHashtagEntity from "../database/entities/tiktok-hashtag.entity";
import TiktokIndustryEntity from "../database/entities/tiktok-industry.entity";
import { blacklistHashtags } from "./const";
import taskGetCreatorData from "./task-get-creator-data";
import taskGetHashtags from "./task-get-hashtag";
import taskGetVideoByHashtag from "./task-get-hashtag-video";
import taskGetVideoDetail from "./task-get-video-detail";
import TiktokHelper from "./tiktok-helper";
import {
  PopularHashtag,
  TiktokCreatorDetail,
  TiktokCreatorVideo,
  TiktokVideoStats,
  TiktokVideoTimelineByHashtag,
} from "./tiktok-types";

async function upsertPopularHashtags(hashtags: PopularHashtag[]) {
  try {
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }

    const hashtagsFromDB = await TiktokHashtagEntity.find();

    const distinctHashtags = hashtags.filter(
      (hashtag, index, self) =>
        index === self.findIndex((t) => t.hashtag_id === hashtag.hashtag_id),
    );

    const hashtagsToInsert = distinctHashtags.map((hashtag) => {
      const hashtagFromDB = hashtagsFromDB.find(
        (h) => h.id === hashtag.hashtag_id,
      );
      const rawHashtag = TiktokHashtagEntity.create({
        id: hashtag.hashtag_id,
        name: hashtag.hashtag_name,
        isPromoted: hashtag.is_promoted,
        publishCount: hashtag.publish_cnt,
        videoViews: hashtag.video_views,
        trend: hashtag.trend,
        updateCount: 0,
        country: { id: hashtag.country_info.id } as TiktokCountryEntity,
        industry: { id: hashtag.industry_info.id + "" } as TiktokIndustryEntity,
      });
      if (hashtagFromDB) {
        rawHashtag.updateCount = hashtagFromDB.updateCount + 1;
      }

      return rawHashtag;
    }) as TiktokHashtagEntity[];
    await TiktokHashtagEntity.upsert(hashtagsToInsert, ["id"]);
  } catch (error: any) {
    console.log(
      `Error upserting popular hashtags, reason: ${error.message}`,
      error,
    );
  }
}

async function upsertCreatorData(
  data: {
    creator: {
      user: TiktokCreatorDetail;
      stats: TiktokVideoStats;
    };
    videos: TiktokVideoTimelineByHashtag[];
  }[],
  industry: TiktokIndustryEntity,
) {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const creatorsFromDB = await CreatorEntity.find({
    relations: ["videos", "industries"],
  });

  const distinctCreators = data.filter(
    (c, index, self) =>
      index ===
      self.findIndex(
        (t) => t.creator.user.uniqueId === c.creator.user.uniqueId,
      ),
  );

  for (const {
    creator: { user, stats },
    videos,
  } of distinctCreators) {
    try {
      const creatorFromDB = creatorsFromDB.find(
        (c) => c.uniqueId === user.uniqueId,
      );

      let totalLike = 0;
      let totalComment = 0;
      let totalShare = 0;
      let totalView = 0;
      let totalCollect = 0;

      const videosToInsert = videos.map((video) => {
        const stats = TiktokHelper.getStats(video);
        const rawVideo = CreatorVideoEntity.create({
          id: video.id,
          desc: video.desc,
          createTime: video.createTime,
          textExtra: video.textExtra,
          likeCount: stats.like,
          commentCount: stats.comment,
          shareCount: stats.share,
          viewCount: stats.view,
          collectCount: video.stats.collectCount,
          creator: { id: user.id } as CreatorEntity,
        });
        totalLike += stats.like;
        totalComment += stats.comment;
        totalShare += stats.share;
        totalView += stats.view;
        totalCollect += video.stats.collectCount;
        return rawVideo;
      });

      const social = TiktokHelper.getCreatorSocialFromSignature({
        creator: user,
      });
      const rawCreator = CreatorEntity.create({
        id: user.id,
        uniqueId: user.uniqueId,
        nickName: user.nickname,
        ttSeller: user.ttSeller,
        language: user.language,
        avatar: user.avatarThumb,
        private: user.privateAccount,
        verified: user.verified,
        description: user.signature,
        bioLink: user.bioLink?.link,
        email: social.email,
        phone: social.phone,
        instagram: social.instagram,
        followerCount: stats.followerCount,
        videoCount: stats.videoCount,
        likeCount: totalLike,
        viewCount: totalView,
        commentCount: totalComment,
        shareCount: totalShare,
        collectCount: totalCollect,
        country: { id: user.region } as TiktokCountryEntity,
        industries: [],
      });

      if (creatorFromDB) {
        rawCreator.updateCount = creatorFromDB.updateCount + 1;
        rawCreator.bioLink = creatorFromDB.bioLink || rawCreator.bioLink;
        rawCreator.email = creatorFromDB.email || rawCreator.email;
        rawCreator.phone = creatorFromDB.phone || rawCreator.phone;
        rawCreator.instagram = creatorFromDB.instagram || rawCreator.instagram;
      }

      await rawCreator.save();
      await CreatorVideoEntity.upsert(videosToInsert, ["id"]);
      industry.creators.push(rawCreator);
      await industry.save();
    } catch (error: any) {
      console.log(
        `Error upserting creator data @${user.uniqueId}, reason: ${error.message}`,
        error,
      );
    }
  }
}

const SEND_TELEGRAM_MESSAGE = true;
const TELEGRAM_BOT_TOKEN = "5826817750:AAEdXO0HOcacEiC8ba5M8YMsBF13S9aVZjM";
const TELEGRAM_CHAT_ID = "732121879";
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=`;
async function sendTelegramMessage(message: string) {
  if (!SEND_TELEGRAM_MESSAGE) {
    return;
  }

  const url = `${TELEGRAM_API_URL}${encodeURIComponent(message)}`;
  const response = await fetch(url);
  if (!response.ok) {
    console.error("Failed to send message to telegram", response.statusText);
  }
}

async function main(countryCode: string, industryId: string) {
  try {
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }

    const country = await TiktokCountryEntity.findOneByOrFail({
      id: countryCode,
    });
    const industry = await TiktokIndustryEntity.findOneOrFail({
      where: { id: industryId },
      relations: ["creators"],
    });

    const industries = [industry];

    const industrieString = industries.map((i) => i.value).join(", ");
    await sendTelegramMessage(
      `Start scraping data for ${country.value} in [${industrieString}] industries`,
    );

    const startHashtagTask = Date.now();
    const hashtagsData = await taskGetHashtags(country, industries);
    const hashtags = hashtagsData.filter(
      (h) => !blacklistHashtags.find((b) => b.includes(h.hashtag_name)),
    );
    const endHashtagTask = Date.now();
    const durationHashtagTask = Math.floor(
      (endHashtagTask - startHashtagTask) / 1000,
    );

    console.log(
      `Get hashtags complete, got ${hashtags.length} hashtags in ${durationHashtagTask}s`,
    );
    await sendTelegramMessage(
      `Get hashtags complete, got ${hashtags.length} hashtags in ${durationHashtagTask}s`,
    );
    await upsertPopularHashtags(hashtags);
    await sendTelegramMessage("Upsert popular hashtags complete");

    const startVideoByHashtags = Date.now();
    const videoByHashtags = await taskGetVideoByHashtag(hashtags);
    const endVideoByHashtags = Date.now();
    const durationVideoByHashtags = Math.floor(
      (endVideoByHashtags - startVideoByHashtags) / 1000,
    );
    console.log(
      `Get videos by hashtags complete, got ${videoByHashtags.length} videos in ${durationVideoByHashtags}s`,
    );
    await sendTelegramMessage(
      `Get videos by hashtags complete, got ${videoByHashtags.length} videos in ${durationVideoByHashtags}s`,
    );

    // FOR TESTING
    // const videoByHashtag = fs.readFileSync(
    //   path.resolve(__dirname, "dummy-video-by-hashtag.json"),
    //   "utf-8",
    // );

    // const videoByHashtags = [JSON.parse(videoByHashtag)];

    const startCreatorData = Date.now();
    const creatorData = await taskGetCreatorData(videoByHashtags);
    const endCreatorData = Date.now();
    const durationCreatorData = Math.floor(
      (endCreatorData - startCreatorData) / 1000,
    );
    console.log(
      `Get creator data complete, got ${creatorData.length} creators in ${durationCreatorData}s`,
    );
    await sendTelegramMessage(
      `Get creator data complete, got ${creatorData.length} creators in ${durationCreatorData}s`,
    );

    await upsertCreatorData(creatorData, industry);
    console.log(
      `Upsert creator data on industries [${industrieString}] complete`,
    );
    await sendTelegramMessage(
      `Upsert creator data on industries [${industrieString}] complete`,
    );

    // TODO: Implement get video detail task
  } catch (error: any) {
    await sendTelegramMessage(`Error scraping data, reason: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

async function upsertVideoDetail(
  videos: TiktokCreatorVideo[],
  creator: CreatorEntity,
) {
  try {
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }

    videos
      .map((video) => {
        const videoFromDb = creator.videos.find((v) => v.id === video.id);
        if (!videoFromDb) {
          return undefined;
        }
        videoFromDb.address =
          video.contentLocation?.address?.streetAddress || null;
        videoFromDb.suggestedWords = video.suggestedWords;
        videoFromDb.potentialCategories = video.diversificationLabels;

        return videoFromDb;
      })
      .filter((v) => v) as CreatorVideoEntity[];
    creator.visibility = true;
    await creator.save();
    await CreatorVideoEntity.save(creator.videos);
  } catch (error: any) {
    console.log(
      `Error upserting video detail, reason: ${error.message}`,
      error,
    );
  }
}

async function main2() {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const creators = await CreatorEntity.find({
    where: {
      // sync videos condition
      visibility: false,
    },
    relations: ["videos"],
  });

  await sendTelegramMessage("Start get and upsert video detail");
  for (let i = 0; i < creators.length; i++) {
    const creator = creators[i];
    const videos = await taskGetVideoDetail(creator);
    await upsertVideoDetail(videos, creator);
  }
  console.log("Get and upsert video detail complete");
  await sendTelegramMessage("Get and upsert video detail complete");
}

process.on("exit", async (code) => {
  if (code === 0) {
    console.log("exit successfully");
    await sendTelegramMessage("Process scraping data complete");
  } else {
    console.log("exit with error");
    await sendTelegramMessage(`Process scraping data error with code: ${code}`);
  }
  setTimeout(() => {
    process.exit(code);
  }, 1000);
});

// catches ctrl+c event
process.on("SIGINT", async (signal) => {
  console.log(`Error with signal ${signal}`);
  await sendTelegramMessage(
    `Process scraping data SIGINT with signal ${signal}`,
  );
  process.exit(1);
});

// catches "kill pid" (for example: nodemon restart)
process.on("SIGUSR1", async (signal) => {
  console.log(`Error with signal ${signal}`);
  await sendTelegramMessage(
    `Process scraping data SIGUSR1 with signal ${signal}`,
  );
  process.exit(1);
});
process.on("SIGUSR2", async (signal) => {
  await sendTelegramMessage(
    `Process scraping data SIGUSR2 with signal ${signal}`,
  );
  process.exit(1);
});

// catches uncaught exceptions
process.on("uncaughtException", async (error) => {
  console.log(`Uncaught Exception error ${error}`);
  await sendTelegramMessage(
    `Process scraping data uncaughtException with error ${error}`,
  );
});

(async () => {
  const PROCESS_NAME = "GET_VIDEO_DETAIL" as "GET_DATA" | "GET_VIDEO_DETAIL";

  if (PROCESS_NAME == "GET_DATA") {
    // Yang dikomen ini untuk sudah dijalankan
    // await main("ID", "10000000000");
    // await main("ID", "11000000000");
    // await main("ID", "12000000000");
    // await main("ID", "13000000000");
    // await main("ID", "14000000000");
    // await main("ID", "15000000000");
    // await main("ID", "17000000000");
    // await main("ID", "18000000000");
    // await main("ID", "19000000000");
    // await main("ID", "21000000000");
    // await main("ID", "22000000000");
    // await main("ID", "23000000000");
    await main("ID", "24000000000");
    await main("ID", "25000000000");
    await main("ID", "26000000000");
    await main("ID", "27000000000");
    await main("ID", "28000000000");
    await main("ID", "29000000000");
  } else if (PROCESS_NAME == "GET_VIDEO_DETAIL") {
    await main2();
  }
})();
