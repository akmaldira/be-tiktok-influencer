import {
  createAnalysisController,
  getAnalysisController,
  updateAnalysisController,
} from "controllers/analysis.controller";
import { Router } from "express";
import authorizationMiddleware from "middlewares/authorization.middleware";

const analysisRoute = Router();

analysisRoute.post("/", authorizationMiddleware(), createAnalysisController);
analysisRoute.get("/", authorizationMiddleware(), getAnalysisController);
analysisRoute.get(
  "/update",
  authorizationMiddleware(),
  updateAnalysisController,
);

export default analysisRoute;
