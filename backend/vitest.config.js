import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./tests/helpers/setup.js"],
    // mongodb-memory-server downloads a binary on first run
    testTimeout: 30000,
    hookTimeout: 60000,
    // Mongoose models are registered globally; parallel files would clash
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["controllers/**", "middleware/**", "libs/**", "routes/**"],
    },
  },
});
