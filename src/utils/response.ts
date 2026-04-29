// ============================================================
// Response Helpers — standardized JSON envelopes
// Every response follows RapidAPI best-practice format
// ============================================================

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-RapidAPI-Key, X-RapidAPI-Host',
  'Access-Control-Max-Age': '86400',
};

export const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  ...CORS_HEADERS,
};

// ─── Success envelope ─────────────────────────────────────────
export function successResponse(data: unknown, meta?: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      meta: {
        engine: 'VCO/1.0',
        mode: 'deterministic',
        latencyClass: 'edge-ms',
        ...meta,
      },
    }),
    { status: 200, headers: JSON_HEADERS }
  );
}

// ─── Error envelope ───────────────────────────────────────────
export function errorResponse(code: number, message: string, details?: unknown): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code,
        message,
        details: details ?? null,
      },
    }),
    { status: code, headers: JSON_HEADERS }
  );
}

// ─── Rate limit response ──────────────────────────────────────
export function rateLimitResponse(retryAfterMs: number, resetAt: number): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: 429,
        message: 'Rate limit exceeded. Upgrade your plan for higher limits.',
        retryAfterMs,
        resetAt: new Date(resetAt).toISOString(),
      },
    }),
    {
      status: 429,
      headers: {
        ...JSON_HEADERS,
        'Retry-After': String(Math.ceil(retryAfterMs / 1000)),
        'X-RateLimit-Reset': new Date(resetAt).toISOString(),
      },
    }
  );
}

// ─── Options (CORS preflight) ─────────────────────────────────
export function optionsResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// ─── Timing helper ────────────────────────────────────────────
export function addTiming(response: Response, startMs: number): Response {
  const elapsed = Date.now() - startMs;
  const headers = new Headers(response.headers);
  headers.set('X-Processing-Time-Ms', String(elapsed));
  headers.set('X-VCO-Engine', 'deterministic/edge');
  return new Response(response.body, { status: response.status, headers });
}
