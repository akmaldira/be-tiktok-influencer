import { isMainThread, parentPort, Worker } from "worker_threads";
import dataSource from "../../src/database/data-source";
import CreatorEntity from "../../src/database/entities/creator.entity";
import TiktokCountryEntity from "../../src/database/entities/tiktok-country.entity";
import TiktokHashtagEntity from "../../src/database/entities/tiktok-hashtag.entity";
import TiktokIndustryEntity from "../../src/database/entities/tiktok-industry.entity";
import TiktokHelper from "../../src/thread/tiktok-helper";
import { TiktokVideoTimelineByHashtag } from "../../src/thread/tiktok-types";

function importWorker(path: string, options?: WorkerOptions) {
  const resolvedPath = require.resolve(path);
  return new Worker(resolvedPath, {
    ...options,
    execArgv: /\.ts$/.test(resolvedPath)
      ? ["--require", "ts-node/register"]
      : undefined,
  });
}

function splitIndustriesIntoChunks(
  industries: TiktokIndustryEntity[],
  chunkSize: number,
) {
  const chunks: TiktokIndustryEntity[][] = [];
  for (let i = chunkSize; i > 0; i--) {
    chunks.push(industries.splice(0, Math.ceil(industries.length / i)));
  }
  return chunks;
}

async function updatePopularHashtag(
  newHashtags: Partial<TiktokHashtagEntity>[],
) {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const oldPopularHashtag = await TiktokHashtagEntity.find();
  const newPopularHashtag = newHashtags.map((hashtag) => {
    const oldHashtag = oldPopularHashtag.find(
      (old) => old.name === hashtag.name,
    );
    if (oldHashtag) {
      return {
        ...oldHashtag,
        ...hashtag,
        updateCount: oldHashtag.updateCount + 1,
      };
    }
    return hashtag;
  });

  await TiktokHashtagEntity.upsert(newPopularHashtag, ["id"]);
}

async function getOneIndustry(id: string) {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }
  return await TiktokIndustryEntity.findOne({
    where: { id },
    relations: ["creators"],
  });
}

async function upsertCreatorFromVideo(
  video: TiktokVideoTimelineByHashtag,
  industry: TiktokIndustryEntity,
) {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  if (!video.author) throw new Error(`Author not found in video ${video.id}`);
  let creatorEntity = await CreatorEntity.findOne({
    where: { uniqueId: video.author.uniqueId },
  });

  const newSocial = TiktokHelper.getCreatorSocialFromSignature({
    creator: video.author,
  });
  if (!creatorEntity) {
    creatorEntity = new CreatorEntity();
    creatorEntity.id = video.author.id;
    creatorEntity.uniqueId = video.author.uniqueId;
    creatorEntity.visibility = false;
    creatorEntity.instagram = newSocial.instagram;
    creatorEntity.email = newSocial.email;
    creatorEntity.phone = newSocial.phone;
    creatorEntity.updateCount = 0;
  } else {
    creatorEntity.instagram = newSocial.instagram || creatorEntity.instagram;
    creatorEntity.email = newSocial.email || creatorEntity.email;
    creatorEntity.phone = newSocial.phone || creatorEntity.phone;
    creatorEntity.updateCount = creatorEntity.updateCount += 1;
  }
  creatorEntity.nickName = video.author.nickname;
  creatorEntity.avatar = video.author.avatarThumb;
  creatorEntity.ttSeller = video.author.ttSeller;
  creatorEntity.private = video.author.privateAccount;
  creatorEntity.verified = video.author.verified;
  creatorEntity.description = video.author.signature
    ? video.author.signature.length == 0
      ? null
      : video.author.signature
    : null;
  creatorEntity.followerCount = video.authorStats?.followerCount || null;
  creatorEntity.likeCount = video.authorStats?.heartCount || null;

  await creatorEntity.save();

  industry.creators.push(creatorEntity);
  await industry.save();
  return creatorEntity;
}

async function runWorker({ industries, country, workerName }: WorkerMessage) {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const ttHelper = new TiktokHelper({
    workerName,
    maxTry: 3,
    maxTryInitialHeader: 5,
    onInitialHeaderMaxTry(error: any) {
      parentPort?.postMessage(`error: ${error}`);
    },
  });

  ttHelper.logger.log(`INFO: worker ${workerName} started...`);
  ttHelper.logger.log(
    `INFO: processing ${industries.length} (${industries.map((i) => i.id)}) on country ${country.id}...`,
  );

  for await (const industry of industries) {
    const industryEntity = await getOneIndustry(industry.id);
    if (!industryEntity) {
      throw new Error(`Industry ${industry.id} not found`);
    }

    const popularHashtags = await ttHelper.getPopularHashtag({
      filter: {
        country_code: country.id,
        industry_id: industry.id,
        limit: 50,
        page: 1,
        period: 7,
        sort_by: "popular",
      },
      maxData: 50,
    });

    await updatePopularHashtag(popularHashtags);
    for (const hashtag of popularHashtags) {
      if (!hashtag.name) continue;
      const videoListByHashtag = await ttHelper.getVideosByHashtag({
        hashtag: hashtag.name,
        limit: 50,
      });

      const distinctVideosAuthor = videoListByHashtag.filter((v, i, a) => {
        const { like, share, comment, view } = TiktokHelper.getStats(v);
        const engagementRate = (like + share + comment) / view;
        const minimumEngagement = 0.05;
        return (
          engagementRate >= minimumEngagement &&
          a.findIndex((t) => t.author!.uniqueId === v.author!.uniqueId) === i
        );
      });
      ttHelper.logger.log(
        `INFO: got ${videoListByHashtag.length} videos and ${distinctVideosAuthor.length} unique author with engagement rate >5% from hashtag ${hashtag.name!}...`,
      );

      let upsertTryCount = 0;
      for (let i = 0; i < distinctVideosAuthor.length; i++) {
        const video = distinctVideosAuthor[i];
        if (!video.author) {
          continue;
        }

        try {
          ttHelper.logger.log(
            `INFO: upserting creator @${video.author.uniqueId}...`,
          );
          await upsertCreatorFromVideo(video, industryEntity);

          upsertTryCount = 0;
        } catch (error: any) {
          if (upsertTryCount < ttHelper.maxTry) {
            ttHelper.logger.error(
              error,
              `ERROR (${upsertTryCount + 1}): upsertCreatorFromVideo (@${video.author.uniqueId}), reason: ${error.message}. retrying...`,
            );
            upsertTryCount++;
            i--;
          } else {
            ttHelper.logger.error(
              error,
              `ERROR (${upsertTryCount + 1}): upsertCreatorFromVideo (@${video.author.uniqueId}), reason: ${error.message}. skipping...`,
            );
            upsertTryCount = 0;
          }
        }
      }
      ttHelper.logger.log(
        `INFO: upserting creator from hashtag ${hashtag.name} done...`,
      );
    }
    ttHelper.logger.log(
      `INFO: upserting creator from industry ${industryEntity.id} done...`,
    );
  }
  ttHelper.logger.log(`INFO: worker ${workerName} done...`);
  parentPort?.postMessage("done");
}

type WorkerMessage = {
  industries: TiktokIndustryEntity[];
  country: TiktokCountryEntity;
  workerName: string;
};
async function main() {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }
  const industries = await TiktokIndustryEntity.find({
    order: { id: "ASC" },
    take: 8,
  });
  const country = await TiktokCountryEntity.findOne({ where: { id: "ID" } });
  if (!country) {
    console.error("Country not found");
    process.exit(1);
  }

  const industryChunks = splitIndustriesIntoChunks(industries, numCPUs);
  let workerDone = 0;
  let i = 0;
  for (const chunks of industryChunks) {
    const worker = importWorker(__filename);
    worker.on("message", (message) => {
      if (message === "done") {
        worker.unref();
        workerDone++;
        if (workerDone === numCPUs) {
          console.log("All workers done");
          process.exit(0);
        }
      } else if (message.includes("error")) {
        const [, msg] = message.split(":");
        console.error(`Worker error: ${msg}`);
      }
    });
    worker.postMessage({
      industries: chunks,
      country,
      workerName: `worker-${i + 1}`,
    } as WorkerMessage);
    i++;
  }
}

// const numCPUs = require("os").cpus().length;
const numCPUs = 4;
if (isMainThread) {
  main();
} else {
  parentPort?.on(
    "message",
    async ({ industries, country, workerName }: WorkerMessage) => {
      if (industries === undefined || typeof industries !== "object") {
        parentPort?.postMessage("error: invalid industries");
        return;
      }

      if (country === undefined || typeof country !== "object") {
        parentPort?.postMessage("error: invalid country");
        return;
      }

      if (workerName === undefined || typeof workerName !== "string") {
        parentPort?.postMessage("error: invalid workerName");
        return;
      }
      await runWorker({ industries, country, workerName });
    },
  );
}
