/**
 * Prompt injection neutralization.
 * Regex-based detection and neutralization of known injection patterns.
 */

interface InjectionPattern {
  pattern: RegExp;
  replacement: string;
  label: string;
}

const INJECTION_PATTERNS: InjectionPattern[] = [
  // "Ignore previous instructions" and variants
  {
    pattern: /ignore\s+(?:all\s+)?(?:previous|prior|above|earlier|preceding)\s+(?:instructions?|prompts?|directions?|rules?|context)/gi,
    replacement: '[injection attempt removed]',
    label: 'ignore-instructions',
  },
  // "Forget everything" variants
  {
    pattern: /forget\s+(?:all|everything)\s+(?:you\s+(?:know|were|have)|about|before)/gi,
    replacement: '[injection attempt removed]',
    label: 'forget-everything',
  },
  // "You are now" role reassignment
  {
    pattern: /you\s+are\s+now\s+(?:a\s+)?(?:different|new|my|an?\s+)/gi,
    replacement: '[injection attempt removed]',
    label: 'role-reassignment',
  },
  // "Your new instructions" / "new prompt" / "override"
  {
    pattern: /(?:your\s+new|new\s+(?:instructions?|prompt|role|task))\s*(?:are|is|:)/gi,
    replacement: '[injection attempt removed]',
    label: 'new-instructions',
  },
  // Role prefix injection: "System:", "Assistant:", "User:" at start of line
  {
    pattern: /^(System|Assistant|User|Human|AI)\s*:/gim,
    replacement: '[$1]:',
    label: 'role-prefix',
  },
  // XML tag injection: <system>, <instruction>, <prompt>, etc.
  {
    pattern: /<\/?\s*(?:system|instruction|prompt|context|role|tool_call|function_call|api_call)\s*>/gi,
    replacement: '[tag removed]',
    label: 'xml-injection',
  },
  // Markdown code fences labeled as system/instructions
  {
    pattern: /```(?:system|instructions?|prompt|override)\b/gi,
    replacement: '```text',
    label: 'code-fence-injection',
  },
  // "Do not" follow/obey safety patterns
  {
    pattern: /do\s+not\s+(?:follow|obey|listen\s+to|respect)\s+(?:your|the|any)\s+(?:safety|security|rules?|guidelines?|instructions?|restrictions?)/gi,
    replacement: '[injection attempt removed]',
    label: 'disable-safety',
  },
  // "Jailbreak" / "DAN" / "developer mode"
  {
    pattern: /(?:jailbreak|dan\s+mode|developer\s+mode|unrestricted\s+mode|god\s+mode)/gi,
    replacement: '[injection attempt removed]',
    label: 'jailbreak',
  },
];

// Suspiciously long base64 strings (100+ chars) — possible encoded payloads
const LONG_BASE64 = /(?<![A-Za-z0-9+/=])[A-Za-z0-9+/=]{100,}(?![A-Za-z0-9+/=])/g;

export function sanitizeInjection(input: string): string {
  let result = input;

  for (const { pattern, replacement } of INJECTION_PATTERNS) {
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;
    result = result.replace(pattern, replacement);
  }

  // Replace suspiciously long base64 with notice
  result = result.replace(LONG_BASE64, '[long encoded string removed]');

  return result;
}
