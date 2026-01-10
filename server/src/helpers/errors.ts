export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function asErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function asHttpError(error: unknown, fallbackStatus: number = 500): HttpError {
  if (error instanceof HttpError) return error;
  return new HttpError(fallbackStatus, asErrorMessage(error));
}
