import { existsSync } from "node:fs";
import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

dotenv.config({ path: existsSync(".env.local") ? ".env.local" : ".env" });

export default defineConfig({
  schema: "./prisma/schema.prisma",
});
