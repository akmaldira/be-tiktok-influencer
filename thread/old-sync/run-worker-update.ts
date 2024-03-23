import { Worker, WorkerOptions } from "worker_threads";
import dataSource from "../../src/database/data-source";
import CreatorEntity from "../../src/database/entities/creator.entity";

const numOfCores = 4;
function importWorker(path: string, options?: WorkerOptions) {
  const resolvedPath = require.resolve(path);
  return new Worker(resolvedPath, {
    ...options,
    execArgv: /\.ts$/.test(resolvedPath)
      ? ["--require", "ts-node/register"]
      : undefined,
  });
}

function splitCreatorsIntoChunks(creators: CreatorEntity[], chunkSize: number) {
  const chunks: CreatorEntity[][] = [];
  for (let i = chunkSize; i > 0; i--) {
    chunks.push(creators.splice(0, Math.ceil(creators.length / i)));
  }
  return chunks;
}

async function main() {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const creators = await CreatorEntity.find();

  const creatorChunks = splitCreatorsIntoChunks(creators, numOfCores);
  let workerLength = 1;
  let workerDone = 0;
  for (const chunk of creatorChunks) {
    const worker = importWorker("./worker-update.ts");
    worker.on("message", (value: string) => {
      console.log(`\n\n${value}\n\n`);
      if (value.includes("done")) {
        worker.unref();
        workerDone++;
        if (workerDone === numOfCores) {
          process.exit(0);
        }
      }
      if (value.includes("error")) {
        worker.unref();
        console.error(`worker-${workerLength} error`);
        workerDone++;
      }
    });
    worker.postMessage({
      creators: chunk,
      workerName: `update-worker-${workerLength}`,
    });
    workerLength++;
  }
}

main();
