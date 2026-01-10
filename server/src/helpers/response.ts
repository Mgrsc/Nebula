import type { ApiErrorBody } from "../../../shared/api";

export function errorResponse(message: string, status: number = 400): Response {
  const body: ApiErrorBody = { ok: false, error: message };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

export function notFound(message: string = "not found"): Response {
  return errorResponse(message, 404);
}

export function serverError(message: string = "internal server error"): Response {
  return errorResponse(message, 500);
}
