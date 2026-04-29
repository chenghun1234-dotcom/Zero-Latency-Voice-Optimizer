// ============================================================
// Rate Limiter & RapidAPI Auth Middleware
// Sliding window counter stored in Cloudflare KV
// No external service required — pure edge logic
// ============================================================

export interface RateLimitConfig {
  windowMs: number;    // window size in milliseconds
  maxRequests: number; // max requests per window
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;     // Unix timestamp ms when the window resets
  retryAfterMs: number;
}

// KV-backed sliding window rate limiter
export async function checkRateLimit(
  kv: KVNamespace,
  identifier: string,       // RapidAPI subscriber ID or IP
  plan: 'basic' | 'pro' | 'ultra',
): Promise<RateLimitResult> {
  const PLAN_LIMITS: Record<string, RateLimitConfig> = {
    basic: { windowMs: 60_000, maxRequests: 10 },      // 10 req/min
    pro: { windowMs: 60_000, maxRequests: 100 },       // 100 req/min
    ultra: { windowMs: 60_000, maxRequests: 1_000 },   // 1000 req/min
  };

  const config = PLAN_LIMITS[plan] ?? PLAN_LIMITS.basic;
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const kvKey = `rl:${identifier}:${plan}`;

  // Read current counter
  const raw = await kv.get(kvKey, 'json') as { count: number; windowStart: number } | null;

  let count = 0;
  let wStart = now;

  if (raw && raw.windowStart > windowStart) {
    // Still within the same window
    count = raw.count;
    wStart = raw.windowStart;
  } else {
    // New window
    count = 0;
    wStart = now;
  }

  const resetAt = wStart + config.windowMs;
  const allowed = count < config.maxRequests;

  if (allowed) {
    // Increment counter (TTL = window duration + buffer)
    await kv.put(kvKey, JSON.stringify({ count: count + 1, windowStart: wStart }), {
      expirationTtl: Math.ceil(config.windowMs / 1000) + 5,
    });
  }

  return {
    allowed,
    remaining: Math.max(0, config.maxRequests - count - (allowed ? 1 : 0)),
    resetAt,
    retryAfterMs: allowed ? 0 : resetAt - now,
  };
}

// ─── RapidAPI Header Validation ───────────────────────────────
export interface RapidAPIContext {
  subscriberId: string;
  plan: 'basic' | 'pro' | 'ultra';
  isValid: boolean;
}

export function parseRapidAPIHeaders(request: Request): RapidAPIContext {
  const subscriberId = request.headers.get('X-RapidAPI-Subscription') ?? '';
  const planHeader = (request.headers.get('X-RapidAPI-Billing-Plan') ?? 'BASIC').toUpperCase();

  // Map RapidAPI plan names to internal tiers
  let plan: 'basic' | 'pro' | 'ultra' = 'basic';
  if (planHeader.includes('PRO') || planHeader.includes('MEGA')) plan = 'pro';
  if (planHeader.includes('ULTRA') || planHeader.includes('MEGA_PLUS')) plan = 'ultra';

  return {
    subscriberId: (subscriberId || request.headers.get('CF-Connecting-IP')) ?? 'unknown',
    plan,
    isValid: true, // RapidAPI proxies handle real auth; we trust headers
  };
}
