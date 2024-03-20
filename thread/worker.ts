import { parentPort } from "worker_threads";
import dataSource from "../src/database/data-source";
import CreatorEntity from "../src/database/entities/creator.entity";
import TiktokCountryEntity from "../src/database/entities/tiktok-country.entity";
import TiktokHashtagEntity from "../src/database/entities/tiktok-hashtag.entity";
import TiktokIndustryEntity from "../src/database/entities/tiktok-industry.entity";
import TiktokSyncHelper from "./tiktok-sync-helper";
import { RunWorkerProps, WorkerMessage } from "./types";

async function run({ workerName, country, industries }: RunWorkerProps) {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }
  const countryList = await TiktokCountryEntity.find();
  const helper = new TiktokSyncHelper({
    workerName: workerName,
    maxTryCount: 3,
    maxTryCountInitialHeaders: 5,
    onGetInitialHeadersMaxTry(error) {
      parentPort?.postMessage(`error: ${error}`);
    },
  });

  for await (const industry of industries) {
    const industryEntity = await TiktokIndustryEntity.findOne({
      where: {
        id: industry.id,
      },
      relations: ["creators"],
    });
    if (!industryEntity) {
      console.error(`Industry not found: ${industry.id}`);
      continue;
    }

    const hashtags = await helper.getAllPopularHashtags({
      filter: {
        page: 1,
        limit: 50,
        period: 7,
        country_code: country.id,
        industry_id: industry.id,
        sort_by: "popular",
      },
    });

    await TiktokHashtagEntity.upsert(hashtags, {
      conflictPaths: ["name"],
    });

    const authorVideos = await helper.getAllVideosByManyHashtag({
      hashtags: hashtags.map((hashtag) => hashtag.name!),
      country: country,
      industry: industry,
    });
    for await (const author of authorVideos) {
      const creatorDetail = await helper.getCreatorDetailByVideoAuthor({
        author,
      });

      if (
        !creatorDetail ||
        !countryList.find((c) => c.id === author.country.id)
      ) {
        continue;
      }

      let creator = await CreatorEntity.findOne({
        where: {
          id: creatorDetail.user.id,
        },
      });
      const socialMedia =
        TiktokSyncHelper.getCreatorInfoFromUserDetail(creatorDetail);

      if (!creator) {
        creator = new CreatorEntity();
        creator.id = creatorDetail.user.id;
      }
      creator.uniqueId = creatorDetail.user.uniqueId;
      creator.nickName = creatorDetail.user.nickname;
      creator.language = creatorDetail.user.language;
      creator.avatar = creatorDetail.user.avatarThumb;
      creator.private = creatorDetail.user.privateAccount;
      creator.verified = creatorDetail.user.verified;
      creator.visibility = true;
      creator.description = creatorDetail.user.signature;
      creator.bioLink = creatorDetail.user.bioLink?.link || null;
      creator.instagram = socialMedia.instagram;
      creator.phone = socialMedia.phone;
      creator.email = socialMedia.email;
      creator.followerCount = creatorDetail.stats.followerCount;
      creator.likeCount = creatorDetail.stats.heartCount;
      creator.videoCount = creatorDetail.stats.videoCount;
      creator.country = {
        id: country.id,
      } as TiktokCountryEntity;

      await creator.save();
      industryEntity.creators.push(creator);
      await industryEntity.save();
    }
  }
}

parentPort?.on("message", async (data: WorkerMessage) => {
  if (!data) {
    console.error("No data received");
    process.exit(1);
  }
  if (!data.country || !data.industries || !data.workerName) {
    console.error("Invalid data received");
    process.exit(1);
  }

  await run(data);
});
