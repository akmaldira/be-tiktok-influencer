// import { parentPort } from "worker_threads";
// import dataSource from "../src/database/data-source";
// import CreatorEntity from "../src/database/entities/creator.entity";
// import TiktokCountryEntity from "../src/database/entities/tiktok-country.entity";
// import TiktokIndustryEntity from "../src/database/entities/tiktok-industry.entity";
// import { COUNTRY_CODE } from "./enum";
// import {
//   Logger,
//   getAllPopularHashtag,
//   getCreatorDetail,
//   getInitialHeaders,
//   getVideoListByManyHastag,
// } from "./helper";

// async function handler({
//   country,
//   industries,
//   workerName,
// }: {
//   country: TiktokCountryEntity;
//   industries: TiktokIndustryEntity[];
//   workerName: string;
// }) {
//   const logger = new Logger(workerName);
//   if (!dataSource.isInitialized) {
//     await dataSource.initialize();
//   }
//   const initialHeaders = await getInitialHeaders(undefined, logger);
//   const countryList = await TiktokCountryEntity.find();
//   for (const industry of industries) {
//     const hashtagList = await getAllPopularHashtag(
//       {
//         filter: {
//           page: 1,
//           limit: 50,
//           period: 7,
//           country_code: country.id as COUNTRY_CODE,
//           industry_id: industry.id,
//           sort_by: "popular",
//         },
//         initialHeaders,
//       },
//       logger,
//     );

//     logger.log(
//       `Got ${hashtagList.length} popular hashtags on industry ${industry.value || industry.id}`,
//     );

//     const authorByIndustry = await getVideoListByManyHastag(
//       hashtagList,
//       country.id,
//       logger,
//     );

//     logger.log(
//       `Got ${authorByIndustry.length} unique authors on industry ${industry.value || industry.id}`,
//     );

//     for await (const author of authorByIndustry) {
//       try {
//         const creatorDetail = await getCreatorDetail(author.uniqueId, logger);
//         if (!creatorDetail) {
//           continue;
//         }
//         const {
//           userInfo: { user, stats },
//         } = creatorDetail;

//         if (user && stats && countryList.some((c) => c.id === user.region)) {
//           await dataSource.transaction(async (manager) => {
//             let userFromDb = await manager.findOne(CreatorEntity, {
//               where: {
//                 id: user.id,
//               },
//               relations: ["industries", "country"],
//             });

//             if (userFromDb) {
//               userFromDb.nickName = user.nickname;
//               userFromDb.avatar = user.avatarThumb;
//               userFromDb.description = user.signature;
//               userFromDb.verified = user.verified;
//               userFromDb.private = user.privateAccount;
//               userFromDb.country = country;
//               userFromDb.language = user.language;
//               userFromDb.followerCount = stats.followerCount;
//               userFromDb.likeCount = stats.heartCount;
//               userFromDb.videoCount = stats.videoCount;
//               userFromDb.industries = [...userFromDb.industries, industry];
//               await manager.save(CreatorEntity, userFromDb);
//             } else {
//               userFromDb = new CreatorEntity();
//               userFromDb.id = user.id;
//               userFromDb.uniqueId = user.uniqueId;
//               userFromDb.nickName = user.nickname;
//               userFromDb.avatar = user.avatarThumb;
//               userFromDb.description = user.signature;
//               userFromDb.verified = user.verified;
//               userFromDb.private = user.privateAccount;
//               userFromDb.country = user.region;
//               userFromDb.language = user.language;
//               userFromDb.followerCount = stats.followerCount;
//               userFromDb.likeCount = stats.heartCount;
//               userFromDb.videoCount = stats.videoCount;
//               userFromDb.industries = [industry];
//               await manager.save(CreatorEntity, userFromDb);
//             }
//           });

//           logger.log(`Upserted creator: ${user.uniqueId}`);
//         }
//       } catch (error) {
//         logger.error(
//           error,
//           `Skipping creator: ${author.uniqueId} due to error`,
//         );
//         continue;
//       }
//     }
//   }
//   const industriesString = industries.map((industry) => industry.id).join(", ");
//   logger.log(
//     `Worker: ${workerName}: Country: ${country.id} with industries: ${industriesString} done.`,
//   );
//   parentPort?.postMessage(
//     `Worker: ${workerName}: Country: ${country.id} with industries: ${industriesString} done.`,
//   );
// }

// parentPort?.on(
//   "message",
//   async (data: {
//     country: TiktokCountryEntity;
//     industries: TiktokIndustryEntity[];
//     workerName: string;
//   }) => {
//     await handler(data);
//   },
// );

// // (async () => {
// //   if (!dataSource.isInitialized) {
// //     await dataSource.initialize();
// //   }
// //   const country = await TiktokCountryEntity.findOne({
// //     where: {
// //       id: "ID",
// //     },
// //   });
// //   const industries = await TiktokIndustryEntity.find({
// //     relations: ["creators"],
// //     take: 10,
// //     order: {
// //       id: "ASC",
// //     },
// //   });

// //   if (!country) {
// //     console.error("Country not found");
// //     process.exit(1);
// //   }

// //   await handler({
// //     country,
// //     industries,
// //     workerName: "worker-1",
// //   });
// // })();
