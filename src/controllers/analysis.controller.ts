import VideoAnalysisEntity from "database/entities/analysis.entity";
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
    const { videoUrl } = parse(createAnalysisBodySpec, req.body);

    if (!isValidTiktokVideo(videoUrl)) {
      throw new BadRequestError({
        message: "Invalid video URL",
      });
    }

    const user = await UserEntity.findOne({
      where: { id: req.user!.id },
      relations: ["videoAnalyses"],
    });

    if (!user) {
      throw new BadRequestError({
        message: "User not found",
      });
    }

    if (user.videoAnalyses.length >= 10) {
      throw new BadRequestError({
        message: "You can only analyze up to 10 videos",
      });
    }

    if (user.videoAnalyses.some((analysis) => analysis.videoUrl === videoUrl)) {
      throw new BadRequestError({
        message: "You have already analyzed this video",
      });
    }

    const videoDetail = await fetchVideo(videoUrl);
    console.log(videoDetail);

    const analysis = new VideoAnalysisEntity();

    analysis.videoUrl = videoUrl;
    analysis.likeCount = videoDetail.like;
    analysis.commentCount = videoDetail.comment;
    analysis.shareCount = videoDetail.share;
    analysis.viewCount = videoDetail.view;
    analysis.collectCount = videoDetail.collect;
    analysis.user = user;

    await analysis.save();

    const response = BaseResponse.success(analysisResponseSpec(analysis));
    res.json(response);
  },
);

export const getAnalysisController = tryCatchController(
  async (req: Request, res: Response) => {
    const user = req.user!;
    const analyses = await VideoAnalysisEntity.find({
      where: {
        user: {
          id: user.id,
        },
      },
      order: { createdAt: "DESC" },
    });

    const response = BaseResponse.success(analyses.map(analysisResponseSpec));
    res.json(response);
  },
);

export const updateAnalysisController = tryCatchController(
  async (req: Request, res: Response) => {
    const { id } = parse(updateAnalysisQuerySpec, req.query);

    const analyses = [] as VideoAnalysisEntity[];
    if (id) {
      const analysisFromId = await VideoAnalysisEntity.findOne({
        where: {
          id,
          user: {
            id: req.user!.id,
          },
        },
      });

      if (!analysisFromId) {
        throw new BadRequestError({
          message: "Analysis video not found",
        });
      }

      analyses.push(analysisFromId);
    } else {
      const analysesFromUser = await VideoAnalysisEntity.find({
        where: {
          user: {
            id: req.user!.id,
          },
        },
      });

      analyses.push(...analysesFromUser);
    }

    console.log(analyses);

    const updatedAnalyses = await Promise.all(
      analyses.map(async (analysis) => {
        const videoDetail = await fetchVideo(analysis.videoUrl);

        const oldData =
          analysis.oldData == null
            ? []
            : (JSON.parse(analysis.oldData) as any[]);

        oldData.push({
          likeCount: Number(analysis.likeCount),
          commentCount: Number(analysis.commentCount),
          shareCount: Number(analysis.shareCount),
          viewCount: Number(analysis.viewCount),
          collectCount: Number(analysis.collectCount),
          createdAt: analysis.updatedAt,
        });

        analysis.likeCount = videoDetail.like;
        analysis.commentCount = videoDetail.comment;
        analysis.shareCount = videoDetail.share;
        analysis.viewCount = videoDetail.view;
        analysis.collectCount = videoDetail.collect;
        analysis.oldData = JSON.stringify(oldData);

        await analysis.save();

        return analysisResponseSpec(analysis);
      }),
    );

    const response = BaseResponse.success(updatedAnalyses);

    res.json(response);
  },
);
