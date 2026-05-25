import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 config.
 *
 * Reads `DATABASE_URL` directly from `process.env` rather than `prisma/config`'s
 * `env()` helper. The helper throws at config-load time when the variable is
 * missing — but that breaks `prisma generate`, which doesn't need a real DB
 * connection at all (it only generates TypeScript from the schema).
 *
 * In practice this matters in two places:
 *
 * 1. **CI `npm ci`.** The `postinstall` script runs `prisma generate` before
 *    the workflow has had a chance to inject `DATABASE_URL`. Falling back to a
 *    placeholder lets installation succeed; the real URL is set on later steps
 *    that actually talk to a DB (migrate, seed, integration tests).
 *
 * 2. **Production-style `npm ci --omit=dev`.** Same scenario — `prisma generate`
 *    fires before the deploy environment provides DB credentials.
 *
 * Runtime code never reads through this config — Prisma Client receives the
 * URL directly from the driver adapter wired in `src/lib/prisma.ts`. So the
 * placeholder here cannot leak into a real query.
 */
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl,
  },
});
