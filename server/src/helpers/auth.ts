import type { Context } from "elysia";
import { getAuthStatus, validateSession } from "../services/auth";
import { errorResponse } from "./response";

export function requireAuth() {
  return ({ headers }: Context) => {
    const authStatus = getAuthStatus();

    if (!authStatus.enabled || !authStatus.configured) {
      return undefined;
    }

    const authHeader = headers.authorization || headers.Authorization;
    if (!authHeader) {
      return errorResponse("Authentication required", 401);
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!validateSession(token)) {
      return errorResponse("Invalid or expired session", 401);
    }

    return undefined;
  };
}
