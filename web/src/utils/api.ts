export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function readErrorMessage(res: Response): Promise<{ message: string; payload: unknown }> {
  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const payload: any = await res.json();
      const message =
        typeof payload?.error === "string" && payload.error.trim().length
          ? payload.error
          : typeof payload?.message === "string" && payload.message.trim().length
            ? payload.message
            : JSON.stringify(payload);
      return { message, payload };
    } catch {
    }
  }

  try {
    const text = await res.text();
    return { message: text || `HTTP ${res.status}`, payload: text };
  } catch {
    return { message: `HTTP ${res.status}`, payload: null };
  }
}

export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const { message, payload } = await readErrorMessage(res);
    throw new ApiError(message, res.status, payload);
  }

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  return (await res.text()) as T;
}
