import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["packages/*/test/**/*.test.ts", "sims/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"] },
});
