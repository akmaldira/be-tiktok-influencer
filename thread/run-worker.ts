import { Worker, WorkerOptions } from "worker_threads";
import dataSource from "../src/database/data-source";
import TiktokCountryEntity from "../src/database/entities/tiktok-country.entity";
import TiktokIndustryEntity from "../src/database/entities/tiktok-industry.entity";
import { WorkerResponse } from "./types";

const numOfCores = 5;
function importWorker(path: string, options?: WorkerOptions) {
  const resolvedPath = require.resolve(path);
  return new Worker(resolvedPath, {
    ...options,
    execArgv: /\.ts$/.test(resolvedPath)
      ? ["--require", "ts-node/register"]
      : undefined,
  });
}

function splitIndustriesIntoChunks(
  industries: TiktokIndustryEntity[],
  chunkSize: number,
) {
  const chunks: TiktokIndustryEntity[][] = [];
  for (let i = chunkSize; i > 0; i--) {
    chunks.push(industries.splice(0, Math.ceil(industries.length / i)));
  }
  return chunks;
}

async function syncPopularHashtagOnCountry(country: TiktokCountryEntity) {
  const industryList = await TiktokIndustryEntity.find({
    relations: ["creators"],
    order: {
      id: "ASC",
    },
  });
  const industryChunks = splitIndustriesIntoChunks(industryList, numOfCores);
  let workerLength = 1;
  let workerDone = 0;
  for (const chunk of industryChunks) {
    const worker = importWorker("./worker.ts");
    worker.on("message", (value: WorkerResponse) => {
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
      country: country,
      industries: chunk,
      workerName: `worker-${workerLength}`,
    });
    workerLength++;
  }
}

async function main() {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const country = await TiktokCountryEntity.findOne({
    where: {
      id: "ID",
    },
  });

  if (!country) {
    console.error("Country not found");
    process.exit(1);
  }

  await syncPopularHashtagOnCountry(country);
}

main();
