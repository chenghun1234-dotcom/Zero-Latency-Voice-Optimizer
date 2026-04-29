// ============================================================
// Rule-based Script Transformer
// Pipeline: Greedy Clean → Entity Extraction → Slot-filling
// Zero LLM calls — purely deterministic, Regex + Trie dictionary
// ============================================================

export interface TransformOptions {
  productName?: string;
  lang?: 'ko' | 'en' | 'auto';
  style?: 'friendly' | 'formal' | 'enthusiastic';
}

export interface TransformResult {
  originalText: string;
  cleanedText: string;
  voiceScript: string;
  entities: ExtractedEntities;
  removedPhrases: string[];
  transformationLog: string[];
}

export interface ExtractedEntities {
  productName: string | null;
  features: string[];
  price: string | null;
  duration: string | null;
  rating: string | null;
  certifications: string[];
  warranty: string | null;
}

// ─── 1. GREEDY CLEANING: Boilerplate & noise removal ─────────
// Phrases that are HARMFUL to voice UX — remove them ruthlessly

const NOISE_PATTERNS_KO: RegExp[] = [
  /상세\s*페이지\s*(참조|참고|확인)/gi,
  /모니터\s*(사양|설정|환경)\s*(에\s*따라|에\s*의해)\s*(색상이|색이|다를|틀릴)\s*수\s*있(습니다|음)/gi,
  /실제\s*(색상|색감|사이즈|크기)\s*와\s*다를\s*수\s*있(습니다|음)/gi,
  /※\s*.{0,80}/g,                           // disclaimer marks
  /\*\s*.{0,80}/g,                           // asterisk notes
  /\[\s*(무료배송|당일발송|사은품|증정품?)\s*\]/gi, // promo badges in brackets
  /저작권법에\s*의해.{0,100}/gi,
  /무단\s*(전재|복제|배포).{0,80}/gi,
  /(상품|제품)\s*(구매|주문)\s*전\s*(반드시|꼭)\s*읽어.{0,100}/gi,
  /공식\s*(수입|판매|유통)\s*(원|처|업체)/gi,
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // emails
  /https?:\/\/[^\s]+/g,                      // URLs
  /℃|℉|㎞|㎡|㎥|㎎|㎏|㎜|㎝/g,            // unit symbols → will be re-added as text
  /[■□▶▷◀◁●○◆◇★☆✓✔]/g,                    // decorative symbols
  /\s{2,}/g,                                 // multiple spaces
];

const NOISE_PATTERNS_EN: RegExp[] = [
  /see\s+product\s+description\s+for\s+details/gi,
  /colors?\s+may\s+vary\s+(due\s+to\s+monitor\s+settings?)?/gi,
  /all\s+rights\s+reserved/gi,
  /terms\s+and\s+conditions\s+apply/gi,
  /while\s+supplies?\s+last/gi,
  /sold\s+by\s+[^\n.]{0,50}/gi,
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  /https?:\/\/[^\s]+/g,
  /\s{2,}/g,
];

function greedyClean(text: string, lang: string): { cleaned: string; removed: string[] } {
  const removed: string[] = [];
  let cleaned = text;

  const patterns = lang === 'en' ? NOISE_PATTERNS_EN : [...NOISE_PATTERNS_KO, ...NOISE_PATTERNS_EN];

  for (const pattern of patterns) {
    const matches = cleaned.match(pattern);
    if (matches) {
      matches.forEach(m => {
        const trimmed = m.trim();
        if (trimmed.length > 3) removed.push(trimmed);
      });
      cleaned = cleaned.replace(pattern, ' ');
    }
  }

  return { cleaned: cleaned.trim(), removed: [...new Set(removed)] };
}

// ─── 2. ENTITY EXTRACTION: Keyword dictionary + Regex ────────

// Feature keyword dictionary (Korean)
const FEATURE_KEYWORDS_KO = new Map<string, string>([
  ['방수', '방수 기능'],
  ['IPX', '방수 등급'],
  ['생활방수', '생활방수'],
  ['무선', '무선'],
  ['블루투스', '블루투스'],
  ['노이즈 캔슬링', '노이즈 캔슬링'],
  ['급속충전', '급속 충전'],
  ['무선충전', '무선 충전'],
  ['UV', 'UV 차단'],
  ['SPF', 'SPF 자외선 차단'],
  ['오가닉', '오가닉(유기농)'],
  ['유기농', '유기농'],
  ['천연', '천연 소재'],
  ['항균', '항균 처리'],
  ['탈취', '탈취 기능'],
  ['접이식', '접이식'],
  ['경량', '경량 설계'],
  ['스테인레스', '스테인리스 스틸'],
  ['실리콘', '실리콘 소재'],
  ['탄소섬유', '탄소 섬유'],
]);

// Feature keywords (English)
const FEATURE_KEYWORDS_EN = new Map<string, string>([
  ['waterproof', 'waterproof'],
  ['water resistant', 'water resistant'],
  ['wireless', 'wireless'],
  ['bluetooth', 'Bluetooth'],
  ['noise cancelling', 'noise cancelling'],
  ['fast charging', 'fast charging'],
  ['wireless charging', 'wireless charging'],
  ['organic', 'organic'],
  ['antibacterial', 'antibacterial'],
  ['lightweight', 'lightweight'],
  ['foldable', 'foldable'],
  ['stainless steel', 'stainless steel'],
]);

// Duration patterns
const DURATION_PATTERN = /(\d+)\s*(시간|분|일|주|개월|년|hour|minute|day|week|month|year)/gi;

// Price patterns
const PRICE_PATTERN_KO = /(\d{1,3}(,\d{3})*)\s*원/g;
const PRICE_PATTERN_EN = /\$\s*(\d+(?:\.\d{2})?)|(\d+(?:\.\d{2})?)\s*(USD|EUR|GBP)/gi;

// Rating patterns
const RATING_PATTERN = /(\d+\.?\d*)\s*(점|star|stars|\/\s*5|out\s*of\s*5)/gi;

// Certification patterns (Korean)
const CERT_PATTERNS_KO: { pattern: RegExp; label: string }[] = [
  { pattern: /KC\s*인증/gi, label: 'KC 인증' },
  { pattern: /식약처\s*승인/gi, label: '식약처 승인' },
  { pattern: /HACCP/gi, label: 'HACCP 인증' },
  { pattern: /ISO\s*\d+/gi, label: 'ISO 인증' },
  { pattern: /CE\s*마크/gi, label: 'CE 인증' },
  { pattern: /FDA\s*(승인|인증)/gi, label: 'FDA 승인' },
];

// Warranty patterns
const WARRANTY_PATTERN = /(\d+)\s*(년|개월|months?|years?)\s*(무상\s*)?보증|warranty/gi;

function extractEntities(text: string, productName: string | undefined, lang: string): ExtractedEntities {
  // Product name
  const extractedProductName = productName ?? extractProductName(text, lang);

  // Features
  const features: string[] = [];
  const keywordMap = lang === 'en' ? FEATURE_KEYWORDS_EN : new Map([...FEATURE_KEYWORDS_KO, ...FEATURE_KEYWORDS_EN]);

  for (const [keyword, label] of keywordMap) {
    if (text.toLowerCase().includes(keyword.toLowerCase())) {
      features.push(label);
    }
  }

  // Duration (battery life, etc.)
  const durationMatches = text.match(DURATION_PATTERN);
  const duration = durationMatches ? durationMatches[0] : null;

  // Price
  const priceKo = text.match(PRICE_PATTERN_KO);
  const priceEn = text.match(PRICE_PATTERN_EN);
  const price = priceKo?.[0] ?? priceEn?.[0] ?? null;

  // Rating
  const ratingMatch = RATING_PATTERN.exec(text);
  const rating = ratingMatch ? ratingMatch[0] : null;
  RATING_PATTERN.lastIndex = 0;

  // Certifications
  const certifications: string[] = [];
  for (const { pattern, label } of CERT_PATTERNS_KO) {
    if (pattern.test(text)) certifications.push(label);
    pattern.lastIndex = 0;
  }

  // Warranty
  const warrantyMatch = WARRANTY_PATTERN.exec(text);
  const warranty = warrantyMatch ? warrantyMatch[0] : null;
  WARRANTY_PATTERN.lastIndex = 0;

  return {
    productName: extractedProductName,
    features: [...new Set(features)],
    price,
    duration,
    rating,
    certifications,
    warranty,
  };
}

function extractProductName(text: string, lang: string): string | null {
  // Look for quoted product names or capitalized brand patterns
  const quoted = text.match(/["'「」『』]([^"'「」『』]{2,30})["'「」『』]/);
  if (quoted) return quoted[1];

  // English: look for Title Case sequences
  if (lang === 'en') {
    const titleCase = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/);
    if (titleCase) return titleCase[1];
  }

  return null;
}

// ─── 3. SLOT-FILLING TEMPLATES ────────────────────────────────

function buildVoiceScript(entities: ExtractedEntities, style: string, lang: string): string {
  const parts: string[] = [];

  const name = entities.productName ?? (lang === 'ko' ? '이 제품' : 'this product');
  const isKo = lang !== 'en';

  // Opening hook
  if (style === 'enthusiastic') {
    parts.push(isKo
      ? `잠깐, ${name} 들어보셨나요? 정말 대단한 제품이에요!`
      : `Wait until you hear about the ${name} — you're going to love it!`);
  } else if (style === 'friendly') {
    parts.push(isKo
      ? `안녕하세요! 오늘 소개할 제품은 ${name}이에요.`
      : `Hey there! Let me tell you about the ${name}.`);
  } else {
    parts.push(isKo
      ? `${name}을 소개합니다.`
      : `Introducing the ${name}.`);
  }

  // Features sentence
  if (entities.features.length > 0) {
    const featureList = entities.features.slice(0, 3).join(isKo ? ', ' : ', ');
    if (isKo) {
      parts.push(`이 제품의 핵심 기능은 ${featureList}${entities.features.length > 1 ? ' 등이에요' : '이에요'}.`);
    } else {
      parts.push(`Key features include ${featureList}.`);
    }
  }

  // Duration (battery life etc.)
  if (entities.duration) {
    parts.push(isKo
      ? `배터리는 ${entities.duration} 동안 사용할 수 있어요. 하루 종일 걱정 없죠!`
      : `It lasts up to ${entities.duration} on a single charge — no worries all day!`);
  }

  // Price
  if (entities.price) {
    parts.push(isKo
      ? `가격은 ${entities.price}이에요. 가성비 정말 좋죠?`
      : `Priced at just ${entities.price} — incredible value!`);
  }

  // Certifications
  if (entities.certifications.length > 0) {
    parts.push(isKo
      ? `${entities.certifications.join(', ')} 까지 완료된 믿을 수 있는 제품이에요.`
      : `This product is certified: ${entities.certifications.join(', ')}.`);
  }

  // Warranty
  if (entities.warranty) {
    parts.push(isKo
      ? `${entities.warranty} 보증도 제공되니 안심하고 구매하세요!`
      : `Backed by a ${entities.warranty} — shop with confidence!`);
  }

  // Rating
  if (entities.rating) {
    parts.push(isKo
      ? `고객 평점도 ${entities.rating}이나 돼요. 믿어도 되겠죠?`
      : `Rated ${entities.rating} by customers — speak for itself!`);
  }

  // Closing CTA
  if (style === 'enthusiastic') {
    parts.push(isKo ? '지금 바로 확인해 보세요!' : 'Check it out right now!');
  } else if (style === 'friendly') {
    parts.push(isKo ? '마음에 드셨으면 좋겠어요!' : "Hope you love it as much as we do!");
  }

  return parts.join(' ');
}

// ─── Main transform function ──────────────────────────────────
export function transformToVoiceScript(
  text: string,
  options: TransformOptions = {}
): TransformResult {
  const { productName, style = 'friendly' } = options;
  const lang = options.lang === 'auto' || !options.lang
    ? detectLang(text)
    : options.lang;

  const log: string[] = [];

  // Step 1: Clean
  log.push('Step 1: Greedy cleaning - removing noise phrases');
  const { cleaned, removed } = greedyClean(text, lang);
  log.push(`  Removed ${removed.length} noise phrase(s)`);

  // Step 2: Extract entities from ORIGINAL text (before cleaning removes numbers/prices)
  log.push('Step 2: Entity extraction (from original text)');
  const entities = extractEntities(text, productName, lang);
  log.push(`  Found: ${entities.features.length} feature(s), price=${entities.price}, duration=${entities.duration}`);

  // Step 3: Slot-fill
  log.push('Step 3: Slot-filling template generation');
  const voiceScript = buildVoiceScript(entities, style, lang);
  log.push(`  Generated voice script (${voiceScript.length} chars)`);

  return {
    originalText: text,
    cleanedText: cleaned,
    voiceScript,
    entities,
    removedPhrases: removed,
    transformationLog: log,
  };
}

function detectLang(text: string): 'ko' | 'en' {
  const koreanChars = (text.match(/[\uAC00-\uD7A3]/g) ?? []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) ?? []).length;
  return koreanChars >= latinChars ? 'ko' : 'en';
}
