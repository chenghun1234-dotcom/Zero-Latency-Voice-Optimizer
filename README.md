# 🎙️ Voice-SEO Content Optimizer (VCO) API

**Zero-Latency · Privacy-First · AI-Free Voice Copywriter**

VCO is a deterministic, rule-based engine designed to transform robotic product descriptions into natural, high-listenability scripts for voice assistants (Alexa, Google Assistant, Naver Clova). By bypassing LLMs, it offers millisecond-level latency and zero operational costs.

---

## 🚀 Key Features

- **Voice Cadence Score (VCS):** A proprietary algorithm based on a modified Flesch-Kincaid formula, optimized for voice UX in Korean and English.
- **Greedy Noise Cleaning:** Ruthlessly removes "visual-only" boilerplate (e.g., "colors may vary," "see detailed page") that breaks voice flow.
- **Deterministic Slot-Filling:** Extract entities (Price, Features, Rating) and inject them into high-conversion voice templates.
- **Auto SSML Generation:** Automatically inserts `<break>`, `<emphasis>`, and `<prosody>` tags based on punctuation and keywords.
- **Zero-Latency:** Runs entirely on Cloudflare Workers' edge, delivering responses in < 20ms.

---

## 🛠️ Technical Stack

- **Runtime:** Cloudflare Workers (Edge Computing)
- **Engine:** Pure TypeScript (Deterministic Logic)
- **Storage:** Cloudflare KV (Rate limiting & caching)
- **Security:** No data leaves the edge (Privacy-Safe)

---

## 📍 API Endpoints

### 1. `POST /v1/optimize` (Recommended)
The full pipeline. Analyzes original text, transforms it into a voice script, and generates SSML.
- **Input:** Raw product description.
- **Output:** Optimized script + SSML + Listenability improvement metrics.

### 2. `POST /v1/analyze`
Get the Voice Cadence Score and a detailed breakdown of issues (long sentences, hard words).

### 3. `POST /v1/transform`
Pure script generation. Removes noise and applies "friendly" or "enthusiastic" copywriting styles.

### 4. `POST /v1/ssml`
Convert plain text into markup-rich SSML for high-quality TTS output.

---

## 💎 RapidAPI Monetization Strategy

| Tier | Rate Limit | Target User |
| :--- | :--- | :--- |
| **Basic** | 10 req/min | Indie developers / Trial |
| **Pro** | 100 req/min | Small e-commerce sellers |
| **Ultra** | 1,000 req/min | Massive marketplace integrators |

**Selling Point:** "Cheaper than OpenAI, Faster than Google, Safer than both."

---

## 👨‍💻 Local Development

```bash
# Install dependencies
npm install

# Start local dev server
npm run dev

# Deploy to Cloudflare
wrangler deploy
```

> [!NOTE]
> Make sure to create a Cloudflare KV namespace and update the ID in `wrangler.toml` before deploying to production.
