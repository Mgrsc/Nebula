import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { staticPlugin } from "@elysiajs/static";
import { ensureSchema } from "./schema";
import { notFound } from "./helpers/response";
import { authRoutes } from "./routes/auth";
import { backupRoutes } from "./routes/backup";
import { logsRoutes } from "./routes/logs";
import { settingsRoutes } from "./routes/settings";
import { logosRoutes } from "./routes/logos";
import { webhooksRoutes } from "./routes/webhooks";
import { subsRoutes } from "./routes/subs";
import { cleanExpiredSessions } from "./services/auth";
import { startScheduler } from "./services/scheduler";
import path from "path";
import { existsSync } from "fs";

ensureSchema();

cleanExpiredSessions();
setInterval(() => cleanExpiredSessions(), 60 * 60 * 1000);

startScheduler();

const isDev = process.env.NODE_ENV !== "production";
const WEB_DIST_PATH = process.env.WEB_DIST_PATH ?? path.join(__dirname, "../../web/dist");
const WEB_DEV_ORIGIN = process.env.WEB_DEV_ORIGIN ?? "http://localhost:5173";
const HOST = process.env.HOST ?? "0.0.0.0";
const PORT = Number(process.env.PORT ?? 3000);
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map(o => o.trim()) ?? [];
const WEB_ASSETS_PATH = path.join(WEB_DIST_PATH, "assets");
const WEB_INDEX_PATH = path.join(WEB_DIST_PATH, "index.html");
const hasWebDist = existsSync(WEB_ASSETS_PATH) && existsSync(WEB_INDEX_PATH);
const shouldUseWebDist = !isDev && hasWebDist;

console.info("[INFO] web runtime mode", {
  is_dev: isDev,
  web_dist_path: WEB_DIST_PATH,
  web_assets_path: WEB_ASSETS_PATH,
  has_web_dist: hasWebDist,
  should_use_web_dist: shouldUseWebDist,
  web_dev_origin: WEB_DEV_ORIGIN,
  host: HOST,
  port: PORT
});

const app = new Elysia()
  .use(cors({
    origin: isDev ? true : (allowedOrigins.length > 0 ? allowedOrigins : false),
    credentials: true
  }))
  .use(authRoutes)
  .use(backupRoutes)
  .use(logsRoutes)
  .use(settingsRoutes)
  .use(logosRoutes)
  .use(webhooksRoutes)
  .use(subsRoutes)
  .get("/api/health", () => ({ ok: true }));

if (shouldUseWebDist) {
  app.use(
    staticPlugin({
      assets: WEB_ASSETS_PATH,
      prefix: "/assets",
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    })
  );
} else {
  console.warn("[WARN] web dist disabled or unavailable", {
    is_dev: isDev,
    web_dist_path: WEB_DIST_PATH,
    web_assets_path: WEB_ASSETS_PATH,
    web_index_path: WEB_INDEX_PATH,
    has_web_dist: hasWebDist,
    should_use_web_dist: shouldUseWebDist
  });
}

app.get("/*", async ({ path: requestPath, set }) => {
  if (requestPath.startsWith("/api/")) return notFound();

  if (isDev) {
    console.info("[INFO] redirecting ui request to web dev server", {
      request_path: requestPath,
      web_dev_origin: WEB_DEV_ORIGIN
    });
    return Response.redirect(`${WEB_DEV_ORIGIN}${requestPath}`, 302);
  }

  if (!shouldUseWebDist) {
    console.error("[ERROR] frontend dist files not found", {
      request_path: requestPath,
      web_dist_path: WEB_DIST_PATH,
      web_assets_path: WEB_ASSETS_PATH,
      web_index_path: WEB_INDEX_PATH,
      has_web_dist: hasWebDist,
      should_use_web_dist: shouldUseWebDist
    });
    set.status = 500;
    return { error: "Frontend files not found. Please rebuild the application." };
  }

  const file = Bun.file(WEB_INDEX_PATH);

  if (!(await file.exists())) {
    console.error("[ERROR] index.html missing during request", {
      request_path: requestPath,
      web_index_path: WEB_INDEX_PATH
    });
    set.status = 500;
    return { error: "Frontend files not found. Please rebuild the application." };
  }

  set.headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
  set.headers["Pragma"] = "no-cache";
  set.headers["Expires"] = "0";

  return new Response(file);
});

app.listen({
  hostname: HOST,
  port: PORT
});

console.log(`Nebula server listening on http://${HOST}:${app.server?.port}`);
