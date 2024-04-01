import FeedBackEntity from "database/entities/feed-back.entity";
import UserEntity from "database/entities/user.entity";
import BadRequestError from "exceptions/bad-request.exception";
import UnauthorizedError from "exceptions/unauthorized.exception";
import { Request, Response } from "express";
import { createFeedBackBodySpec } from "payload/request/feed-back.request";
import BaseResponse from "payload/response/base-response";
import tryCatchController from "utils/try-catch-controller";
import { parse } from "valibot";

export const createFeedBack = tryCatchController(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const { rating, message } = parse(createFeedBackBodySpec, req.body);

    const oldFeedBack = await FeedBackEntity.findOne({
      where: {
        user: {
          id: req.user.id,
        },
      },
    });

    if (oldFeedBack) {
      throw new BadRequestError({
        message: "Feedback already exists",
      });
    }

    const feedBack = new FeedBackEntity();
    feedBack.rating = rating;
    feedBack.message = message;
    feedBack.user = {
      id: req.user.id,
    } as UserEntity;

    await feedBack.save();

    const response = BaseResponse.success(feedBack);
    return res.json(response);
  },
);

export const getFeedBack = tryCatchController(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const feedBack = await FeedBackEntity.find({
      order: {
        createdAt: "DESC",
      },
    });

    const response = BaseResponse.success(feedBack);
    return res.json(response);
  },
);
