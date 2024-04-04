import dataSource from "database/data-source";
import CampaignEntity from "database/entities/campaign.entity";
import CreatorView from "database/entities/creator-view.entity";
import FeedBackEntity from "database/entities/feed-back.entity";
import UserEntity from "database/entities/user.entity";
import UnauthorizedError from "exceptions/unauthorized.exception";
import { Request, Response } from "express";
import { searchRelevantCreators } from "libs/langchain";
import { createCampaignBodySpec } from "payload/request/campaign.request";
import BaseResponse from "payload/response/base-response";
import tryCatchController from "utils/try-catch-controller";
import { parse } from "valibot";

export const createCampaign = tryCatchController(
  async (req: Request, res: Response) => {
    const {
      country,
      industry,
      category,
      objective,
      product,
      targetAudience,
      timeline,
    } = parse(createCampaignBodySpec, req.body);

    if (!req.user) {
      throw new UnauthorizedError();
    }

    const relevantCreatorsQuery = dataSource.manager
      .createQueryBuilder(CreatorView, "creator")
      // .where("creator.visibility = true")
      .leftJoinAndSelect("creator.country", "country")
      .where("country_id = :country", { country })
      .orderBy("creator.followerCount", "DESC")
      .limit(100);

    if (industry) {
      relevantCreatorsQuery.andWhere(
        `industries @> '[{ "id": "${industry}" }]'`,
      );
    }

    if (category) {
      relevantCreatorsQuery.orWhere(
        `(creator.potentialCategories)::text ilike '%${category}%'`,
      );

      relevantCreatorsQuery.orWhere(
        `(creator.suggestedWords)::text ilike '%${category}%'`,
      );

      relevantCreatorsQuery.orWhere(
        `(creator.textExtras)::text ilike '%${category}%'`,
      );
    }

    res.write("step: find-influencer\n");
    const creators = await relevantCreatorsQuery.getMany();
    if (creators.length === 0) {
      res.write("No influencers found\n");
      return res.end();
    }

    res.write("step: generate-campaign\n");
    const result = await searchRelevantCreators(res, creators, {
      category,
      objective,
      product,
      targetAudience,
      timeline,
      industry,
    });

    const feedback = await FeedBackEntity.findOne({
      where: {
        user: {
          id: req.user.id,
        },
      },
    });

    if (feedback) {
      res.write("feed-back: found\n");
    } else {
      res.write("feed-back: not-found\n");
    }

    const newCampaign = new CampaignEntity();
    newCampaign.user = {
      id: req.user.id,
    } as UserEntity;
    newCampaign.country = country;
    newCampaign.industry = industry || null;
    newCampaign.category = category;
    newCampaign.objective = objective;
    newCampaign.product = product;
    newCampaign.targetAudience = targetAudience;
    newCampaign.timeline = timeline;
    newCampaign.result = result;

    await newCampaign.save();
    return res.end();
  },
);

export const getCampaign = tryCatchController(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const campaigns = await CampaignEntity.find({
      where: {
        user: {
          id: req.user.id,
        },
      },
      order: {
        createdAt: "DESC",
      },
    });

    const response = BaseResponse.success(campaigns);

    return res.json(response);
  },
);
