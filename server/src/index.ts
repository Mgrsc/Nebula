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

ensureSchema();

cleanExpiredSessions();
setInterval(() => cleanExpiredSessions(), 60 * 60 * 1000);

startScheduler();

const isDev = process.env.NODE_ENV !== "production";
const WEB_DIST_PATH = process.env.WEB_DIST_PATH ?? path.join(__dirname, "../../web/dist");
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map(o => o.trim()) ?? [];

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
  .get("/api/health", () => ({ ok: true }))
  .use(
    staticPlugin({
      assets: path.join(WEB_DIST_PATH, "assets"),
      prefix: "/assets",
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    })
  )
  .get("/*", async ({ path: requestPath, set }) => {
    if (requestPath.startsWith("/api/")) return notFound();

    const indexPath = path.join(WEB_DIST_PATH, "index.html");
    const file = Bun.file(indexPath);

    if (!(await file.exists())) {
      console.error(`[ERROR] index.html not found at: ${indexPath}`);
      set.status = 500;
      return { error: "Frontend files not found. Please rebuild the application." };
    }

    set.headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
    set.headers["Pragma"] = "no-cache";
    set.headers["Expires"] = "0";

    return new Response(file);
  })
  .listen(Number(process.env.PORT ?? 3000));

console.log(`Nebula server listening on http://localhost:${app.server?.port}`);