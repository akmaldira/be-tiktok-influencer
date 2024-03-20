import { getCreators, getFilterCreator } from "controllers/creator.controller";
import { Router } from "express";
import authorizationMiddleware from "middlewares/authorization.middleware";

const creatorRoute = Router();

creatorRoute.get("/", authorizationMiddleware(), getCreators);
creatorRoute.get("/filter", authorizationMiddleware(), getFilterCreator);

export default creatorRoute;
