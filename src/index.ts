// ============================================================
// Voice-SEO Content Optimizer (VCO) — Cloudflare Worker
// Zero-Latency, Privacy-Safe, LLM-Free Voice Script Engine
//
// Routes:
//   GET  /health         → Health check (RapidAPI required)
//   GET  /info           → API info & capabilities
//   POST /v1/analyze     → Voice Cadence Score analysis
//   POST /v1/transform   → Rule-based voice script generation
//   POST /v1/ssml        → Auto SSML markup generation
//   POST /v1/optimize    → Full pipeline (analyze + transform + ssml)
// ============================================================

import { analyzeVoiceCadence } from './engines/cadence';
import { transformToVoiceScript } from './engines/transformer';
import { generateSSML } from './engines/ssml';
import { checkRateLimit, parseRapidAPIHeaders } from './middleware/rateLimit';
import {
  successResponse,
  errorResponse,
  rateLimitResponse,
  optionsResponse,
  addTiming,
} from './utils/response';

export interface Env {
  VCO_CACHE: KVNamespace;
  ENVIRONMENT: string;
}

// ─── Request body schemas ─────────────────────────────────────

interface AnalyzeBody {
  text: string;
}

interface TransformBody {
  text: string;
  productName?: string;
  lang?: 'ko' | 'en' | 'auto';
  style?: 'friendly' | 'formal' | 'enthusiastic';
}

interface SSMLBody {
  text: string;
  voiceId?: string;
  lang?: string;
  rate?: 'x-slow' | 'slow' | 'medium' | 'fast' | 'x-fast';
}

interface OptimizeBody extends TransformBody {
  voiceId?: string;
  ssmlLang?: string;
  rate?: 'x-slow' | 'slow' | 'medium' | 'fast' | 'x-fast';
  includeSSML?: boolean;
}

// ─── Input validation ─────────────────────────────────────────

function validateText(text: unknown): text is string {
  return typeof text === 'string' && text.trim().length > 0;
}

const MAX_TEXT_LENGTH = 5_000; // characters

async function parseBody<T>(request: Request): Promise<T | null> {
  try {
    const body = await request.json() as T;
    return body;
  } catch {
    return null;
  }
}

// ─── Route handlers ───────────────────────────────────────────

function handleHealth(): Response {
  return successResponse({
    status: 'operational',
    version: '1.0.0',
    engine: 'deterministic',
    uptime: true,
  });
}

function handleInfo(): Response {
  return successResponse({
    name: 'Voice-SEO Content Optimizer',
    tagline: 'Zero-Latency · Privacy-Safe · LLM-Free',
    version: '1.0.0',
    endpoints: [
      { method: 'POST', path: '/v1/analyze',   description: 'Voice Cadence Score analysis (modified Flesch-Kincaid)' },
      { method: 'POST', path: '/v1/transform', description: 'Rule-based voice script generation (slot-filling)' },
      { method: 'POST', path: '/v1/ssml',      description: 'Auto SSML markup with break/emphasis/prosody tags' },
      { method: 'POST', path: '/v1/optimize',  description: 'Full pipeline: analyze + transform + ssml in one call' },
    ],
    supportedLanguages: ['ko', 'en', 'auto-detect'],
    privacyNote: 'All processing occurs at the edge. No data leaves Cloudflare infrastructure.',
    latencyClass: '10–30ms',
  });
}

async function handleAnalyze(request: Request): Promise<Response> {
  const body = await parseBody<AnalyzeBody>(request);
  if (!body || !validateText(body.text)) {
    return errorResponse(400, 'Missing or invalid "text" field. Provide a non-empty string.');
  }
  if (body.text.length > MAX_TEXT_LENGTH) {
    return errorResponse(400, `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters.`);
  }

  const result = analyzeVoiceCadence(body.text);

  return successResponse({
    input: { length: body.text.length },
    cadenceAnalysis: result,
    recommendation: getRecommendation(result.score),
  });
}

async function handleTransform(request: Request): Promise<Response> {
  const body = await parseBody<TransformBody>(request);
  if (!body || !validateText(body.text)) {
    return errorResponse(400, 'Missing or invalid "text" field.');
  }
  if (body.text.length > MAX_TEXT_LENGTH) {
    return errorResponse(400, `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters.`);
  }

  const result = transformToVoiceScript(body.text, {
    productName: body.productName,
    lang: body.lang ?? 'auto',
    style: body.style ?? 'friendly',
  });

  return successResponse({ transform: result });
}

async function handleSSML(request: Request): Promise<Response> {
  const body = await parseBody<SSMLBody>(request);
  if (!body || !validateText(body.text)) {
    return errorResponse(400, 'Missing or invalid "text" field.');
  }
  if (body.text.length > MAX_TEXT_LENGTH) {
    return errorResponse(400, `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters.`);
  }

  const result = generateSSML(body.text, {
    voiceId: body.voiceId,
    lang: body.lang ?? 'ko-KR',
    rate: body.rate ?? 'medium',
  });

  return successResponse({ ssml: result });
}

async function handleOptimize(request: Request): Promise<Response> {
  const body = await parseBody<OptimizeBody>(request);
  if (!body || !validateText(body.text)) {
    return errorResponse(400, 'Missing or invalid "text" field.');
  }
  if (body.text.length > MAX_TEXT_LENGTH) {
    return errorResponse(400, `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters.`);
  }

  // Step 1: Cadence analysis of original text
  const cadence = analyzeVoiceCadence(body.text);

  // Step 2: Transform to voice script
  const transform = transformToVoiceScript(body.text, {
    productName: body.productName,
    lang: body.lang ?? 'auto',
    style: body.style ?? 'friendly',
  });

  // Step 3: SSML on the voice script
  const ssmlLang = body.ssmlLang ?? (body.lang === 'en' ? 'en-US' : 'ko-KR');
  const ssmlResult = body.includeSSML !== false
    ? generateSSML(transform.voiceScript, {
        voiceId: body.voiceId,
        lang: ssmlLang,
        rate: body.rate ?? 'medium',
      })
    : null;

  // Step 4: Re-score transformed script
  const transformedCadence = analyzeVoiceCadence(transform.voiceScript);

  return successResponse({
    pipeline: 'analyze → transform → ssml',
    original: {
      text: body.text,
      cadenceScore: cadence.score,
      cadenceGrade: cadence.grade,
    },
    optimized: {
      voiceScript: transform.voiceScript,
      cadenceScore: transformedCadence.score,
      cadenceGrade: transformedCadence.grade,
      improvement: transformedCadence.score - cadence.score,
    },
    entities: transform.entities,
    removedPhrases: transform.removedPhrases,
    ssml: ssmlResult,
    recommendation: getRecommendation(transformedCadence.score),
  });
}

// ─── Score recommendation helper ─────────────────────────────
function getRecommendation(score: number): string {
  if (score >= 70) return '✅ Excellent for voice. Ready to publish on Alexa/Google/Naver CUE.';
  if (score >= 55) return '🟡 Good. Minor sentence shortening recommended.';
  if (score >= 40) return '🟠 Fair. Break long sentences. Replace technical jargon with everyday words.';
  return '🔴 Poor. Significant rewrite needed for voice UX. Use the /v1/transform endpoint.';
}

// ─── Main Worker fetch handler ────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const start = Date.now();

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return optionsResponse();
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, ''); // normalize trailing slash

    // ── Rate limiting via KV ──────────────────────────────────
    const rapidCtx = parseRapidAPIHeaders(request);
    const rateResult = await checkRateLimit(env.VCO_CACHE, rapidCtx.subscriberId, rapidCtx.plan);

    if (!rateResult.allowed) {
      return rateLimitResponse(rateResult.retryAfterMs, rateResult.resetAt);
    }

    // ── Routing ───────────────────────────────────────────────
    let response: Response;

    try {
      if ((path === '' || path === '/') && request.method === 'GET') {
        response = handleInfo();

      } else if (path === '/health' && request.method === 'GET') {
        response = handleHealth();

      } else if (path === '/info' && request.method === 'GET') {
        response = handleInfo();

      } else if (path === '/v1/analyze' && request.method === 'POST') {
        response = await handleAnalyze(request);

      } else if (path === '/v1/transform' && request.method === 'POST') {
        response = await handleTransform(request);

      } else if (path === '/v1/ssml' && request.method === 'POST') {
        response = await handleSSML(request);

      } else if (path === '/v1/optimize' && request.method === 'POST') {
        response = await handleOptimize(request);

      } else {
        response = errorResponse(404, `Route ${request.method} ${path} not found.`, {
          availableRoutes: [
            'GET /health',
            'GET /info',
            'POST /v1/analyze',
            'POST /v1/transform',
            'POST /v1/ssml',
            'POST /v1/optimize',
          ],
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      response = errorResponse(500, message);
    }

    // Add rate limit headers + timing
    const headers = new Headers(response.headers);
    headers.set('X-RateLimit-Remaining', String(rateResult.remaining));
    headers.set('X-RateLimit-Reset', new Date(rateResult.resetAt).toISOString());

    const withHeaders = new Response(response.body, { status: response.status, headers });
    return addTiming(withHeaders, start);
  },
} satisfies ExportedHandler<Env>;
