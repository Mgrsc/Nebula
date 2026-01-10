import { Elysia, t } from "elysia";
import { searchLogoCandidates } from "../services/logos";

export const logosRoutes = new Elysia({ prefix: "/api" }).get(
  "/logos/search",
  async ({ query }) => {
    const items = await searchLogoCandidates({ q: query.q ?? null, url: query.url ?? null });
    return { items };
  },
  {
    query: t.Object({
      q: t.Optional(t.String()),
      url: t.Optional(t.String())
    })
  }
);

