import { createCampaign, getCampaign } from "controllers/campaign.controller";
import { Router } from "express";
import authorizationMiddleware from "middlewares/authorization.middleware";

const campaignRoute = Router();

campaignRoute.get("/", authorizationMiddleware(), getCampaign);
campaignRoute.post("/", authorizationMiddleware(), createCampaign);

export default campaignRoute;
