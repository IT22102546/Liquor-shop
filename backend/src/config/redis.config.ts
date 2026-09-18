import { registerAs } from "@nestjs/config";

export const RedisConfig = registerAs("redis", () => ({
  enabled: process.env.REDIS_ENABLED?.toLowerCase() === "true",
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD,
  database: parseInt(process.env.REDIS_DB || "0", 10),
  prefix: process.env.REDIS_PREFIX || "",
  queueDatabase: parseInt(process.env.REDIS_QUEUE_DB || "1", 10),
}));
