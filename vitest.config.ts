import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname), "server-only": path.resolve(__dirname, "test-support/server-only.ts") } },
  test: { include: ["lib/**/*.test.ts"] },
});
