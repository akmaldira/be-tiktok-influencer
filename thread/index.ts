import dataSource from "../src/database/data-source";
import TiktokCountryEntity from "../src/database/entities/tiktok-country.entity";
import TiktokIndustryEntity from "../src/database/entities/tiktok-industry.entity";
import taskGetCreatorData from "./task-get-creator-data";
import taskGetHashtags from "./task-get-hashtag";
import taskGetVideoByHashtag from "./task-get-hashtag-video";

async function main(countryCode: string) {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const country = await TiktokCountryEntity.findOneByOrFail({
    id: countryCode,
  });
  const industries = await TiktokIndustryEntity.find({
    order: {
      id: "ASC",
    },
    take: 1,
  });

  const hashtags = await taskGetHashtags(country, industries);
  console.log(`Get popular hashtags complete, got ${hashtags.length} hashtags`);
  const videoByHashtags = await taskGetVideoByHashtag(hashtags);
  console.log(
    `Get videos by hashtags complete, got ${videoByHashtags.length} videos`,
  );
  const creatorData = await taskGetCreatorData(videoByHashtags);
  console.log(`Get creator data complete, got ${creatorData.length} creators`);
}

(async () => {
  await main("ID");
})();
