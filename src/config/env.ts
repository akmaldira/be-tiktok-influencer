import { config } from "dotenv";
const NODE_ENV = process.env.NODE_ENV || "development";
config({
  path: NODE_ENV === "production" ? ".env" : `.env.${NODE_ENV}`,
});

const {
  PORT,
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  JWT_SECRET,
  DEBUG,
  AI_API_KEY,
} = process.env;

if (!PORT) {
  throw new Error("PORT is not defined");
} else if (isNaN(Number(PORT))) {
  throw new Error("PORT is not a number");
}

if (!DB_HOST) {
  throw new Error("DB_HOST is not defined");
}

if (!DB_PORT) {
  throw new Error("DB_PORT is not defined");
}

if (!DB_USER) {
  throw new Error("DB_USER is not defined");
}

if (!DB_PASSWORD) {
  throw new Error("DB_PASSWORD is not defined");
}

if (!DB_NAME) {
  throw new Error("DB_NAME is not defined");
}

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}

if (!AI_API_KEY) {
  throw new Error("AI_API_KEY is not defined");
}

export const appConfig = {
  NODE_ENV: NODE_ENV,
  PORT: Number(PORT),
  JWT_SECRET: JWT_SECRET,
  DEBUG: DEBUG === "true",
  AI_API_KEY,
};

export const dbConfig = {
  HOST: DB_HOST,
  PORT: Number(DB_PORT),
  USER: DB_USER,
  PASSWORD: DB_PASSWORD,
  DATABASE: DB_NAME,
};
