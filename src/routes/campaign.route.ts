import { createCampaign } from "controllers/campaign.controller";
import { Router } from "express";
import authorizationMiddleware from "middlewares/authorization.middleware";

const campaignRoute = Router();

campaignRoute.post("/", authorizationMiddleware(), createCampaign);

export default campaignRoute;
