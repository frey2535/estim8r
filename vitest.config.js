import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vitest suites only. Standalone Node assert scripts live next to them as
 * `*.test.js` but define no test()/it() — run those via `npm run test:node`.
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(rootDir, "./src") },
  },
  test: {
    environment: "node",
    include: [
      "src/domain/estimate/assemblies.test.js",
      "src/domain/estimate/estimateQualityGate.test.js",
      "src/domain/estimate/estimatingIntelligence.test.js",
      "src/domain/estimate/liveSupplierCatalog.test.js",
      "src/domain/estimate/supplierPriceIntelligence.test.js",
      "src/domain/labor/installationConditions.test.js",
    ],
  },
});
