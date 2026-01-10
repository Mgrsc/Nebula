export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();

  if (init?.signal) {
    const parentSignal = init.signal;
    if (parentSignal.aborted) {
      controller.abort(parentSignal.reason);
    } else {
      parentSignal.addEventListener("abort", () => controller.abort(parentSignal.reason), { once: true });
    }
  }

  const timeout = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
