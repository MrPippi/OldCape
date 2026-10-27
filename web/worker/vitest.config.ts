import path from "node:path";
import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

// Runs worker/test/** inside workerd with a local D1. Static assets are stubbed.
export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, "migrations"));
  return {
    test: {
      globals: true,
      include: ["worker/test/**/*.test.ts"],
      setupFiles: ["./worker/test/apply-migrations.ts"],
      poolOptions: {
        workers: {
          singleWorker: true,
          main: path.join(__dirname, "index.ts"),
          miniflare: {
            compatibilityDate: "2026-10-01",
            d1Databases: ["DB"],
            bindings: { TEST_MIGRATIONS: migrations, TURNSTILE_SECRET: "test-secret", IP_SALT: "test-salt" },
            serviceBindings: { ASSETS: () => new Response("static page") },
          },
        },
      },
    },
  };
});
