import { parentPort } from "worker_threads";
import dataSource from "../src/database/data-source";
import CreatorEntity from "../src/database/entities/creator.entity";
import TiktokSyncHelper from "./tiktok-sync-helper";

async function run({
  workerName,
  creators,
}: {
  workerName: string;
  creators: CreatorEntity[];
}) {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }
  for await (const creator of creators) {
    const creatorEntity = await CreatorEntity.findOne({
      where: {
        id: creator.id,
      },
    });

    if (!creatorEntity) {
      parentPort?.postMessage(`error: Creator not found: ${creator.id}`);
      continue;
    }

    const helper = new TiktokSyncHelper({
      workerName: workerName,
      maxTryCount: 3,
      maxTryCountInitialHeaders: 5,
      onGetInitialHeadersMaxTry(error) {
        parentPort?.postMessage(`error: ${error}`);
      },
    });

    const stats = await helper.getCreatorStats({ creator });
    console.log(stats);
    if (stats) {
      creatorEntity.viewCount = stats.viewCount;
      creatorEntity.commentCount = stats.commentCount;
      creatorEntity.shareCount = stats.shareCount;
      creatorEntity.collectCount = stats.collectCount;
      await creatorEntity.save();
    }
  }
}

parentPort?.on(
  "message",
  async (
    message: { workerName: string; creators: CreatorEntity[] } | unknown,
  ) => {
    if (
      typeof message !== "object" ||
      message === null ||
      !("workerName" in message) ||
      !("creators" in message)
    ) {
      parentPort?.postMessage("error: invalid message");
      return;
    }

    await run({
      workerName: message.workerName as string,
      creators: message.creators as CreatorEntity[],
    });
  },
);
