// ============================================================
// Auto SSML Markup Generator
// Converts plain text voice scripts into SSML-tagged markup
// Purely rule-based: punctuation triggers + keyword dictionary
// ============================================================

export interface SSMLOptions {
  voiceId?: string;   // e.g. "Aria" for Amazon Polly, "ko-KR-Wavenet-A" for GCP
  lang?: string;      // BCP-47 language tag e.g. "ko-KR", "en-US"
  rate?: 'x-slow' | 'slow' | 'medium' | 'fast' | 'x-fast';
}

export interface SSMLResult {
  ssml: string;
  breakCount: number;
  emphasisCount: number;
  prosodyCount: number;
  sayAsCount: number;
  processingSteps: string[];
}

// ─── Trigger rules (applied in order) ────────────────────────

interface SSMLRule {
  pattern: RegExp;
  replace: string | ((match: string, ...groups: string[]) => string);
  label: string;
}

// Korean number reading patterns
const KO_NUMBER_RULES: SSMLRule[] = [
  // Prices: 1,000원 → <say-as interpret-as="cardinal">1000</say-as>원
  {
    pattern: /(\d{1,3}(?:,\d{3})*)\s*원/g,
    replace: (_, n) => `<say-as interpret-as="cardinal">${n.replace(/,/g, '')}</say-as>원`,
    label: 'Korean price (KRW)',
  },
  // Percentages: 30% → 30퍼센트
  {
    pattern: /(\d+(?:\.\d+)?)\s*%/g,
    replace: (_, n) => `<say-as interpret-as="cardinal">${n}</say-as> percent`,
    label: 'Percentage',
  },
  // Dates: 2024년 → 이천이십사년
  {
    pattern: /(\d{4})\s*년/g,
    replace: (_, y) => `<say-as interpret-as="date" format="y">${y}</say-as> year`,
    label: 'Year',
  },
  // Ordinal-like: 제1등 → 제 1등
  {
    pattern: /(\d+)\s*(등|위|번|호)/g,
    replace: (_, n, suffix) => `<say-as interpret-as="ordinal">${n}</say-as>${suffix}`,
    label: 'Korean ordinal/rank',
  },
  // Duration: 10시간 → 10시간
  {
    pattern: /(\d+)\s*(시간|분|초)/g,
    replace: (_, n, unit) => `<say-as interpret-as="cardinal">${n}</say-as>${unit}`,
    label: 'Duration',
  },
];

const EN_NUMBER_RULES: SSMLRule[] = [
  // USD prices
  {
    pattern: /\$(\d+(?:\.\d{2})?)/g,
    replace: (_, n) => `<say-as interpret-as="currency" language="en-US">$${n}</say-as>`,
    label: 'USD price',
  },
  // Percentages
  {
    pattern: /(\d+(?:\.\d+)?)\s*%/g,
    replace: (_, n) => `<say-as interpret-as="cardinal">${n}</say-as> percent`,
    label: 'Percentage',
  },
  // Phone numbers
  {
    pattern: /(\d{3}[-.\s]\d{3}[-.\s]\d{4})/g,
    replace: (_, n) => `<say-as interpret-as="telephone">${n}</say-as>`,
    label: 'Phone number',
  },
];

// Punctuation break rules
const BREAK_RULES: SSMLRule[] = [
  // Period / 마침표 → 500ms pause
  {
    pattern: /(?<=[^\d])\.\s+/g,
    replace: '.<break time="500ms"/> ',
    label: 'Period break',
  },
  // Korean sentence end
  {
    pattern: /([다요죠네며])\.\s*/g,
    replace: (_, ch) => `${ch}.<break time="500ms"/> `,
    label: 'Korean sentence break',
  },
  // Comma pause
  {
    pattern: /,\s+/g,
    replace: ',<break time="200ms"/> ',
    label: 'Comma pause',
  },
  // Semicolon pause
  {
    pattern: /;\s+/g,
    replace: ';<break time="300ms"/> ',
    label: 'Semicolon pause',
  },
  // Colon (listing)
  {
    pattern: /:\s+/g,
    replace: ':<break time="250ms"/> ',
    label: 'Colon pause',
  },
  // Em dash — (often used for appositions)
  {
    pattern: /\s+—\s+/g,
    replace: '<break time="200ms"/> — <break time="200ms"/>',
    label: 'Em-dash pause',
  },
];

// Emphasis rules: exclamations + key positive words
const EMPHASIS_RULES: SSMLRule[] = [
  // Exclamation
  {
    pattern: /([^!]+!)/g,
    replace: (_, s) => `<emphasis level="strong">${s.trim()}</emphasis>`,
    label: 'Exclamation emphasis',
  },
];

// Pitch/prosody rules: questions
const PROSODY_RULES: SSMLRule[] = [
  // Questions get rising pitch
  {
    pattern: /([^?]+\?)/g,
    replace: (_, s) => `<prosody pitch="+5%">${s.trim()}</prosody>`,
    label: 'Question rising pitch',
  },
];

// Keyword emphasis dictionary (brand-level highlights)
const EMPHASIS_KEYWORDS = [
  '최저가', '무료배송', '당일발송', '한정수량',
  'best seller', 'free shipping', 'limited', 'sale',
  '인기', '추천', '신상', '특가',
];

// ─── Main SSML generation ─────────────────────────────────────
export function generateSSML(text: string, options: SSMLOptions = {}): SSMLResult {
  const {
    voiceId = 'default',
    lang = 'ko-KR',
    rate = 'medium',
  } = options;

  const steps: string[] = [];
  let processed = text;
  let breakCount = 0;
  let emphasisCount = 0;
  let prosodyCount = 0;
  let sayAsCount = 0;

  // Detect language from lang tag
  const isKorean = lang.startsWith('ko');

  // Apply number rules
  const numberRules = isKorean ? KO_NUMBER_RULES : EN_NUMBER_RULES;
  for (const rule of numberRules) {
    const before = processed;
    processed = processed.replace(rule.pattern, rule.replace as string);
    if (processed !== before) {
      steps.push(`Applied: ${rule.label}`);
      sayAsCount++;
    }
  }

  // Apply break rules
  for (const rule of BREAK_RULES) {
    const before = processed;
    processed = processed.replace(rule.pattern, rule.replace as string);
    if (processed !== before) {
      const added = (processed.match(/<break/g) ?? []).length - (before.match(/<break/g) ?? []).length;
      breakCount += Math.max(0, added);
      if (added > 0) steps.push(`Applied: ${rule.label} (+${added} breaks)`);
    }
  }

  // Apply question prosody (only if text ends with ?)
  if (text.includes('?')) {
    const before = processed;
    for (const rule of PROSODY_RULES) {
      processed = processed.replace(rule.pattern, rule.replace as string);
    }
    if (processed !== before) {
      prosodyCount++;
      steps.push('Applied: Question rising pitch prosody');
    }
  }

  // Apply exclamation emphasis (only if text ends with !)
  if (text.includes('!') && !text.includes('<emphasis')) {
    const before = processed;
    for (const rule of EMPHASIS_RULES) {
      processed = processed.replace(rule.pattern, rule.replace as string);
    }
    if (processed !== before) {
      emphasisCount++;
      steps.push('Applied: Exclamation strong emphasis');
    }
  }

  // Apply keyword emphasis
  for (const keyword of EMPHASIS_KEYWORDS) {
    const escapedKw = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const kRegex = new RegExp(`\\b${escapedKw}\\b`, 'gi');
    if (kRegex.test(processed)) {
      processed = processed.replace(kRegex, `<emphasis level="moderate">${keyword}</emphasis>`);
      emphasisCount++;
      steps.push(`Applied: Keyword emphasis — "${keyword}"`);
    }
  }

  // Wrap in SSML skeleton
  const voiceAttr = voiceId !== 'default' ? ` name="${voiceId}"` : '';
  const ssml = `<?xml version="1.0" encoding="UTF-8"?>
<speak version="1.1" xmlns="http://www.w3.org/2001/10/synthesis"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://www.w3.org/2001/10/synthesis
                           http://www.w3.org/TR/speech-synthesis11/synthesis.xsd"
       xml:lang="${lang}">
  <voice${voiceAttr}>
    <prosody rate="${rate}">
      ${processed.trim()}
    </prosody>
  </voice>
</speak>`;

  steps.push(`Wrapped in SSML skeleton (lang=${lang}, rate=${rate})`);

  return {
    ssml,
    breakCount,
    emphasisCount,
    prosodyCount,
    sayAsCount,
    processingSteps: steps,
  };
}
