import CreatorEntity from "database/entities/creator.entity";
import TiktokCountryEntity from "database/entities/tiktok-country.entity";
import TiktokIndustryEntity from "database/entities/tiktok-industry.entity";
import { Request, Response } from "express";
import { searchCreatorQuerySpec } from "payload/request/creator.request";
import BaseResponse from "payload/response/base-response";
import tryCatchController from "utils/try-catch-controller";
import { parse } from "valibot";

export const getCreators = tryCatchController(
  async (req: Request, res: Response) => {
    const { pagination, country, industry, followers } = parse(
      searchCreatorQuerySpec,
      req.query,
    );

    const getCreatorsQuery = CreatorEntity.createQueryBuilder("creator")
      .where("creator.visibility = true")
      .leftJoinAndSelect("creator.country", "country")
      .leftJoinAndSelect("creator.industries", "industries")
      .orderBy("creator.followerCount", "DESC");

    if (pagination) {
      getCreatorsQuery
        .take(pagination.perPage)
        .skip(pagination.page ? (pagination.page - 1) * pagination.perPage : 0);
    } else {
      getCreatorsQuery.take(10);
    }

    if (country) {
      getCreatorsQuery.andWhere("country.id = :country", { country });
    }

    if (industry) {
      getCreatorsQuery.andWhere("industries.id = :industry", { industry });
    }

    if (followers) {
      getCreatorsQuery.andWhere(
        "creator.followerCount >= :from AND creator.followerCount <= :to",
        followers,
      );
    }

    const [creators, total] = await getCreatorsQuery.getManyAndCount();
    const creatorsWithEngagementRate = creators.map((creator) => {
      const viewCount = parseInt((creator.viewCount as string | null) || "0");
      const likeCount = parseInt((creator.likeCount as string | null) || "0");
      const commentCount = parseInt(
        (creator.commentCount as string | null) || "0",
      );
      const shareCount = parseInt((creator.shareCount as string | null) || "0");
      let engagementRate = 0;
      if (
        !isNaN(viewCount) &&
        !isNaN(likeCount) &&
        !isNaN(commentCount) &&
        !isNaN(shareCount)
      ) {
        engagementRate =
          ((likeCount + commentCount + shareCount) / viewCount) * 100;
      }
      return {
        ...creator,
        engagementRate,
      };
    });

    const response = BaseResponse.success(creatorsWithEngagementRate, {
      page: pagination?.page || 1,
      perPage: pagination?.perPage || 10,
      total: total,
    });
    return res.json(response);
  },
);

export const getFilterCreator = tryCatchController(
  async (req: Request, res: Response) => {
    const country = await TiktokCountryEntity.find({
      order: { value: "ASC" },
    });

    const industry = await TiktokIndustryEntity.find({
      order: { value: "ASC" },
    });

    const response = BaseResponse.success({
      country,
      industry,
    });

    return res.json(response);
  },
);
