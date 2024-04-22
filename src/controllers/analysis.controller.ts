import CampaignAnalysisDetailEntity from "database/entities/campaign-analysis-detail.entity";
import CampaignAnalysisEntity from "database/entities/campaign-analysis.entity";
import UserEntity from "database/entities/user.entity";
import { analysisResponseSpec } from "dtos/analysis.dto";
import BadRequestError from "exceptions/bad-request.exception";
import { Request, Response } from "express";
import {
  createAnalysisBodySpec,
  updateAnalysisQuerySpec,
} from "payload/request/analysis.request";
import BaseResponse from "payload/response/base-response";
import { fetchVideo, isValidTiktokVideo } from "utils/fetch-video";
import tryCatchController from "utils/try-catch-controller";
import { parse } from "valibot";

export const createAnalysisController = tryCatchController(
  async (req: Request, res: Response) => {
    const { campaignName, details } = parse(createAnalysisBodySpec, req.body);

    const user = await UserEntity.findOne({
      where: { id: req.user!.id },
      relations: ["campaignAnalyses", "campaignAnalyses.details"],
    });

    if (!user) {
      throw new BadRequestError({
        message: "User not found",
      });
    }

    details.forEach((detail) => {
      if (!isValidTiktokVideo(detail.videoUrl)) {
        throw new BadRequestError({
          message: "Invalid video URL",
        });
      }

      user.campaignAnalyses.forEach(({ details }) => {
        if (
          details.some((userDetail) => userDetail.videoUrl == detail.videoUrl)
        ) {
          throw new BadRequestError({
            message: `You have already analyzed ${detail.videoUrl} video`,
          });
        }
      });

      if (details.filter((d) => d.videoUrl == detail.videoUrl).length > 1) {
        throw new BadRequestError({
          message: "Duplicate video URL",
        });
      }
    });

    if (user.campaignAnalyses.length >= 10) {
      throw new BadRequestError({
        message: "You can only analyze up to 10 videos",
      });
    }

    const videoDetails = await Promise.all(
      details.map(async (detail) => {
        const d = await fetchVideo(detail.videoUrl);
        const analysisDetail = new CampaignAnalysisDetailEntity();
        analysisDetail.videoUrl = detail.videoUrl;
        analysisDetail.likeCount = d.like;
        analysisDetail.commentCount = d.comment;
        analysisDetail.shareCount = d.share;
        analysisDetail.viewCount = d.view;
        analysisDetail.collectCount = d.collect;
        analysisDetail.cost = detail.cost ?? null;
        analysisDetail.engagementRate = d.engagementRate;
        return analysisDetail;
      }),
    );

    const analysisData = new CampaignAnalysisEntity();
    analysisData.campaignName = campaignName;
    analysisData.details = videoDetails;
    analysisData.user = user;

    await analysisData.save();
    await CampaignAnalysisDetailEntity.save(
      videoDetails.map(
        (vDetails) =>
          ({
            ...vDetails,
            campaignAnalysis: analysisData,
          }) as CampaignAnalysisDetailEntity,
      ),
    );

    const response = BaseResponse.success(analysisResponseSpec(analysisData));
    res.json(response);
  },
);

export const getAnalysisController = tryCatchController(
  async (req: Request, res: Response) => {
    const user = req.user!;
    const analyses = await CampaignAnalysisEntity.find({
      where: {
        user: {
          id: user.id,
        },
      },
      relations: ["user", "details"],
      order: { createdAt: "DESC" },
    });

    const response = BaseResponse.success(analyses.map(analysisResponseSpec));
    res.json(response);
  },
);

export const updateAnalysisController = tryCatchController(
  async (req: Request, res: Response) => {
    const { id } = parse(updateAnalysisQuerySpec, req.query);

    const analyses = [] as CampaignAnalysisEntity[];
    if (id) {
      const analysisFromId = await CampaignAnalysisEntity.findOne({
        where: {
          id,
          user: {
            id: req.user!.id,
          },
        },
        relations: ["user", "details"],
      });

      if (!analysisFromId) {
        throw new BadRequestError({
          message: "Campaign Analysis not found",
        });
      }

      analyses.push(analysisFromId);
    } else {
      const analysesFromUser = await CampaignAnalysisEntity.find({
        where: {
          user: {
            id: req.user!.id,
          },
        },
        relations: ["user", "details"],
      });

      analyses.push(...analysesFromUser);
    }

    const analysisDetails = analyses.map((analysis) => analysis.details).flat();

    const updatedAnalyses = await Promise.all(
      analysisDetails.map(async (analysisDetail) => {
        const videoDetail = await fetchVideo(analysisDetail.videoUrl);

        const oldData =
          analysisDetail.oldData == null
            ? []
            : (JSON.parse(analysisDetail.oldData) as any[]);

        oldData.push({
          likeCount: Number(analysisDetail.likeCount),
          commentCount: Number(analysisDetail.commentCount),
          shareCount: Number(analysisDetail.shareCount),
          viewCount: Number(analysisDetail.viewCount),
          collectCount: Number(analysisDetail.collectCount),
          engagementRate: Number(analysisDetail.engagementRate),
          createdAt: analysisDetail.updatedAt,
        });

        analysisDetail.likeCount = videoDetail.like;
        analysisDetail.commentCount = videoDetail.comment;
        analysisDetail.shareCount = videoDetail.share;
        analysisDetail.viewCount = videoDetail.view;
        analysisDetail.collectCount = videoDetail.collect;
        analysisDetail.engagementRate = videoDetail.engagementRate;
        analysisDetail.oldData = JSON.stringify(oldData);

        await analysisDetail.save();

        return analysisDetail;
      }),
    );

    const response = BaseResponse.success(updatedAnalyses);

    res.json(response);
  },
);
