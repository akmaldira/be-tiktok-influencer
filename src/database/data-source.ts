import path from "path";
import { DataSource, DataSourceOptions } from "typeorm";
import { appConfig, dbConfig } from "../config/env";

const dataSourceOption: DataSourceOptions = {
  type: "postgres",
  host: dbConfig.HOST,
  port: dbConfig.PORT,
  username: dbConfig.USER,
  password: dbConfig.PASSWORD,
  database: dbConfig.DATABASE,
  logging: appConfig.DEBUG,
  entities: [__dirname + "/entities/*.entity{.js,.ts}"],
  migrations: [path.resolve() + "/migrations/*.js"],
  migrationsTableName: "migrations",
};

export default new DataSource(dataSourceOption);
