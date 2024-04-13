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
      influencerCount,
      creators,
    } = parse(createCampaignBodySpec, req.body);

    if (!req.user) {
      throw new UnauthorizedError();
    }

    let creatorsList: CreatorView[] = [];

    if (!creators) {
      if (!country) {
        throw new Error("Country is required");
      } else if (!category) {
        throw new Error("Category is required");
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
      creatorsList = await relevantCreatorsQuery.getMany();
      if (creatorsList.length === 0) {
        res.write("No influencers found\n");
        return res.end();
      }
    } else {
      if (influencerCount) {
        throw new Error(
          "Influencer count is not required when creators are selected",
        );
      }

      const creatorsListSelected = await dataSource.manager
        .createQueryBuilder(CreatorView, "creator")
        .leftJoinAndSelect("creator.country", "country")
        .where("creator.id IN (:...creators)", {
          creators: creators.map((c) => c.id),
        })
        .orderBy("creator.followerCount", "DESC")
        .getMany();

      if (creatorsListSelected.length !== creators.length) {
        throw new Error("Invalid creators id");
      }
      creatorsList = creatorsListSelected;
    }

    res.write("step: generate-campaign\n");
    const result = await searchRelevantCreators(res, creatorsList, {
      category,
      objective,
      product,
      targetAudience,
      timeline,
      industry,
      influencerCount,
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
    newCampaign.country = country || null;
    newCampaign.industry = industry || null;
    newCampaign.category = category || null;
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
