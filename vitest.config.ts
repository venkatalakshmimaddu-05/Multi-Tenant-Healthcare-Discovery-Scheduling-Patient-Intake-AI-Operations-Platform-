import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    fileParallelism: false,
    environment: "node",
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
