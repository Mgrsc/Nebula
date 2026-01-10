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

ensureSchema();

cleanExpiredSessions();
setInterval(() => cleanExpiredSessions(), 60 * 60 * 1000);

startScheduler();

const app = new Elysia()
  .use(cors({ origin: true, credentials: true }))
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
      assets: "../web/dist",
      prefix: "/"
    })
  )
  .get("/*", ({ path }) => {
    if (path.startsWith("/api/")) return notFound();
    try {
      return Bun.file("../web/dist/index.html");
    } catch {
      return notFound("web not built");
    }
  })
  .listen(Number(process.env.PORT ?? 3000));

console.log(`Nebula server listening on http://localhost:${app.server?.port}`);
