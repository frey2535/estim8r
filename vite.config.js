import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const buildSha = [
  process.env.VITE_APP_BUILD_SHA,
  process.env.CF_PAGES_COMMIT_SHA,
  process.env.GITHUB_SHA,
  process.env.VERCEL_GIT_COMMIT_SHA,
  process.env.COMMIT_SHA,
].find((value) => typeof value === "string" && value.trim())?.trim() || "local";
const builtAt = buildSha === "local" ? "local" : (process.env.VITE_APP_BUILT_AT || process.env.BUILD_TIME || new Date().toISOString());
const spaFallbackRoutes = ["login", "login/owner", "register", "forgot-password", "reset-password", "estimates/new", "labor", "production", "takeoff", "markup", "settings", "profile", "admin"];

function buildVersionPlugin() {
  return {
    name: "estim8r-build-version",
    transformIndexHtml(html) {
      return html.replace(/%ESTIM8R_BUILD_SHA%/g, buildSha);
    },
    writeBundle(outputOptions) {
      const outDir = outputOptions.dir ? path.resolve(rootDir, outputOptions.dir) : path.resolve(rootDir, "dist");
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, "build-version.json"), `${JSON.stringify({ sha: buildSha, builtAt })}\n`);
      const indexPath = path.join(outDir, "index.html");
      if (!fs.existsSync(indexPath)) return;
      const html = fs.readFileSync(indexPath, "utf8").replace(/%ESTIM8R_BUILD_SHA%/g, buildSha);
      fs.writeFileSync(indexPath, html);
      for (const route of spaFallbackRoutes) {
        const routeDir = path.join(outDir, route);
        fs.mkdirSync(routeDir, { recursive: true });
        fs.copyFileSync(indexPath, path.join(routeDir, "index.html"));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), buildVersionPlugin()],
  define: { "import.meta.env.VITE_APP_BUILD_SHA": JSON.stringify(buildSha) },
  resolve: { alias: { "@": path.resolve(rootDir, "./src") } },
  server: { port: 5177, host: true },
});
