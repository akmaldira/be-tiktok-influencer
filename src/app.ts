import cors from "cors";
import express from "express";
import errorMiddleware from "middlewares/error.middleware";
import "reflect-metadata";
import analysisRoute from "routes/analysis.route";
import authRoute from "routes/auth.route";
import campaignRoute from "routes/campaign.route";
import creatorRoute from "routes/creator.route";
import feedBackRoute from "routes/feed-back.route";
import { appConfig } from "./config/env";
import dataSource from "./database/data-source";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use(express.static("public"));
app.use("/api/auth", authRoute);
app.use("/api/creator", creatorRoute);
app.use("/api/campaign", campaignRoute);
app.use("/api/feedback", feedBackRoute);
app.use("/api/analysis", analysisRoute);
app.get("*", (req, res) => {
  res.sendFile("index.html", { root: "public" });
});
app.use(errorMiddleware);

async function listenApp() {
  const db = await dataSource.initialize();
  console.log(`Using database: ${db.options.database}`);
  app.listen(appConfig.PORT, () => {
    console.log(`Server is running on http://localhost:${appConfig.PORT}`);
  });
}

export default listenApp;
