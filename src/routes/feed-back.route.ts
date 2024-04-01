import { createFeedBack, getFeedBack } from "controllers/feed-back.controller";
import { UserRole } from "database/entities/enum";
import { Router } from "express";
import authorizationMiddleware from "middlewares/authorization.middleware";

const feedBackRoute = Router();

feedBackRoute.get("/", authorizationMiddleware([UserRole.ADMIN]), getFeedBack);
feedBackRoute.post("/", authorizationMiddleware(), createFeedBack);

export default feedBackRoute;
