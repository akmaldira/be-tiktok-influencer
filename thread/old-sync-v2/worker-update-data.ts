import { isMainThread, parentPort, Worker } from "worker_threads";
import dataSource from "../../src/database/data-source";
import CreatorVideoEntity from "../../src/database/entities/creator-video.entity";
import CreatorEntity from "../../src/database/entities/creator.entity";
import TiktokCountryEntity from "../../src/database/entities/tiktok-country.entity";
import TiktokHelper from "../tiktok-helper";
import {
  TiktokCreatorDetail,
  TiktokCreatorVideo,
  TiktokVideoTimelineByHashtag,
} from "../tiktok-types";

async function updateCreatorData(creator: TiktokCreatorDetail) {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const creatorEntity = await CreatorEntity.findOne({
    where: { uniqueId: creator.uniqueId },
    relations: ["videos"],
  });

  if (!creatorEntity) {
    throw new Error(`Creator @${creator.uniqueId} not found`);
  }

  const newSocial = TiktokHelper.getCreatorSocialFromSignature({
    creator,
  });

  creatorEntity.avatar = creator.avatarThumb || creatorEntity.avatar;
  creatorEntity.language = creator.language;
  creatorEntity.instagram = newSocial.instagram || creatorEntity.instagram;
  creatorEntity.email = newSocial.email || creatorEntity.email;
  creatorEntity.phone = newSocial.phone || creatorEntity.phone;
  creatorEntity.nickName = creator.nickname || creatorEntity.nickName;
  creatorEntity.ttSeller = creator.ttSeller || creatorEntity.ttSeller;
  creatorEntity.private = creator.privateAccount || creatorEntity.private;
  creatorEntity.verified = creator.verified || creatorEntity.verified;
  creatorEntity.description = creator.signature || creatorEntity.description;
  creatorEntity.bioLink = creator.bioLink?.link || creatorEntity.bioLink;
  creatorEntity.country =
    ({
      id: creator.region,
    } as TiktokCountryEntity) || creatorEntity.country;

  await creatorEntity.save();
  return creatorEntity;
}

async function upsertCreatorVideos(
  creator: CreatorEntity,
  video: TiktokVideoTimelineByHashtag[],
) {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const videosToUpsert = video.map((v) => {
    const videoEntity = new CreatorVideoEntity();
    const stats = TiktokHelper.getStats(v);
    videoEntity.id = v.id;
    videoEntity.createTime = v.createTime;
    videoEntity.desc = v.desc;
    videoEntity.textExtra = v.textExtra;
    videoEntity.likeCount = stats.like;
    videoEntity.shareCount = stats.share;
    videoEntity.commentCount = stats.comment;
    videoEntity.viewCount = stats.view;
    videoEntity.collectCount = v.stats.collectCount;
    videoEntity.creator = creator;
    return videoEntity;
  });

  const upsert = await CreatorVideoEntity.upsert(videosToUpsert, ["id"]);
  return upsert.identifiers;
}

async function updateCreatorVideo(
  creator: CreatorEntity,
  video: TiktokCreatorVideo,
) {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const creatorVideo = await CreatorVideoEntity.findOne({
    where: {
      id: video.id,
      creator: {
        id: creator.id,
      },
    },
  });

  if (!creatorVideo) {
    throw new Error(
      `Video ${video.id} on creator @${creator.uniqueId} not found`,
    );
  }

  creatorVideo.suggestedWords = video.suggestedWords;
  creatorVideo.potentialCategories = video.diversificationLabels;
  creatorVideo.address = video.contentLocation?.address?.streetAddress || null;

  await creatorVideo.save();
  return creatorVideo;
}

function importWorker(path: string, options?: WorkerOptions) {
  const resolvedPath = require.resolve(path);
  return new Worker(resolvedPath, {
    ...options,
    execArgv: /\.ts$/.test(resolvedPath)
      ? ["--require", "ts-node/register"]
      : undefined,
  });
}

function splitCreatorsIntoChunks(creators: CreatorEntity[], chunkSize: number) {
  const chunks: CreatorEntity[][] = [];
  for (let i = chunkSize; i > 0; i--) {
    chunks.push(creators.splice(0, Math.ceil(creators.length / i)));
  }
  return chunks;
}

async function runWorker({}: WorkerMessage) {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }
  // TODO: implement worker logic here
}

type WorkerMessage = {
  creators: CreatorEntity[];
  workerName: string;
};
async function main() {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const creators = await CreatorEntity.find({
    where: {
      visibility: true,
    },
  });

  const creatorChunks = splitCreatorsIntoChunks(creators, numCPUs);
  let workerDone = 0;
  let i = 0;
  for (const chunk of creatorChunks) {
    const worker = importWorker(__filename);
    worker.on("message", (message: string) => {
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
      creators: chunk,
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
  parentPort?.on("message", async ({ creators, workerName }: WorkerMessage) => {
    if (creators === undefined || typeof creators !== "object") {
      parentPort?.postMessage("error: invalid data");
      return;
    }

    if (workerName === undefined || typeof workerName !== "string") {
      parentPort?.postMessage("error: invalid worker name");
      return;
    }
    await runWorker({ creators, workerName });
  });
}

// (async () => {
//   const tiktokHelper = new TiktokHelper({
//     workerName: "tiktok-helper",
//     maxTry: 3,
//     maxTryInitialHeader: 5,
//   });

//   const industryId = "10000000000";
//   const countryCode = "ID";
//   const popularHashtags = await tiktokHelper.getPopularHashtag({
//     filter: {
//       page: 1,
//       limit: 50,
//       period: 7,
//       country_code: countryCode,
//       industry_id: industryId,
//       sort_by: "popular",
//     },
//     maxData: 50,
//   });

//   await updatePopularHashtag(popularHashtags);
//   const industry = await getOneIndustry(industryId);
//   if (!industry) {
//     throw new Error(`Industry ${industryId} not found`);
//   }

//   let creatorTemp: CreatorEntity | undefined;

//   for await (const hashtag of popularHashtags) {
//     const videosByHashtag = await tiktokHelper.getVideosByHashtag({
//       hashtag: hashtag.name!,
//     });
//     const distinctVideosAuthor = videosByHashtag.filter((v, i, a) => {
//       const { like, share, comment, view } = TiktokHelper.getStats(v);
//       const engagementRate = (like + share + comment) / view;
//       const minimumEngagement = 0.05;
//       return (
//         engagementRate >= minimumEngagement &&
//         a.findIndex((t) => t.author!.uniqueId === v.author!.uniqueId) === i
//       );
//     });
//     tiktokHelper.logger.log(
//       `INFO: got ${videosByHashtag.length} videos and ${distinctVideosAuthor.length} unique author with engagement rate >5% from hashtag ${hashtag.name!}...`,
//     );

//     let upsertTryCount = 0;
//     for (let i = 0; i < distinctVideosAuthor.length; i++) {
//       const video = distinctVideosAuthor[i];
//       if (!video.author) {
//         continue;
//       }
//       try {
//         tiktokHelper.logger.log(
//           `INFO: upserting creator @${video.author.uniqueId}...`,
//         );
//         const creators = await upsertCreatorFromVideo(video, industry);
//         creatorTemp = creators;
//         upsertTryCount = 0;
//       } catch (error: any) {
//         if (upsertTryCount < tiktokHelper.maxTry) {
//           tiktokHelper.logger.error(
//             error,
//             `ERROR (${upsertTryCount + 1}): upsertCreatorFromVideo (@${video.author.uniqueId}), reason: ${error.message}. retrying...`,
//           );
//           upsertTryCount++;
//           i--;
//         } else {
//           tiktokHelper.logger.error(
//             error,
//             `ERROR (${upsertTryCount + 1}): upsertCreatorFromVideo (@${video.author.uniqueId}), reason: ${error.message}. skipping...`,
//           );
//           upsertTryCount = 0;
//         }
//       }
//       break;
//     }
//     break;
//   }

//   if (creatorTemp) {
//     const creatorWithVideo = await tiktokHelper.getCreatorDetailAndVideos({
//       uniqueId: creatorTemp.uniqueId,
//     });

//     if (creatorWithVideo) {
//       try {
//         const creator = await updateCreatorData(creatorWithVideo.creatorRes);
//         const creatorVideos = creatorWithVideo.videoRes
//           .map((v) => v.itemList)
//           .flat();

//         const upsertVideos = await upsertCreatorVideos(creator, creatorVideos);

//         for (const { id } of upsertVideos) {
//           const videoData = await tiktokHelper.getVideoDetail({
//             videoId: id,
//             uniqueId: creator.uniqueId,
//           });
//           if (videoData) {
//             await updateCreatorVideo(creator, videoData);
//           }
//         }
//         tiktokHelper.logger.log(
//           `INFO: update creator @${creator.uniqueId} data and videos done...`,
//         );
//       } catch (error: any) {
//         tiktokHelper.logger.error(
//           error,
//           `ERROR: updateCreatorData (@${creatorTemp.uniqueId}), reason: ${error.message}. skipping...`,
//         );
//       }
//     }
//   }
// })();
