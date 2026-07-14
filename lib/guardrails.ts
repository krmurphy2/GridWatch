// Deterministic, pre-LLM guardrails. These run in the server action *before* the
// agent is called, so a filtered request costs zero LLM tokens and zero agent
// round-trips. Keep them cheap and conservative — a false positive here silently
// declines a legitimate question.

export type ChatScreenCategory = "injection" | "trivial" | "offtopic";
export type ChatScreenResult = { category: ChatScreenCategory; reply: string } | null;

// Prompt-injection / jailbreak attempts. Kept specific to avoid false positives.
export const INJECTION_PATTERNS: RegExp[] = [
  // "ignore/disregard/forget ... instructions/prompts/rules" (allows filler words between).
  /(ignore|disregard|forget)\s+.{0,25}\b(instructions|prompts?|rules?|messages?)\b/i,
  /(reveal|show|print|repeat|expose|tell me)\b.{0,30}\b(system\s+)?(prompt|instructions)\b/i,
  /jailbreak/i,
  /\bdo anything now\b/i,
  /\bDAN mode\b/i,
];

// Obvious non-security topics. Matched as whole words so a security question that
// merely mentions one isn't blocked. Deliberately short and obvious — expand this
// list as clearly-off-topic patterns show up in real usage.
export const OUT_OF_SCOPE_KEYWORDS: string[] = [
  "recipe",
  "homework",
  "essay",
  "poem",
  "lyrics",
  "sports",
  "horoscope",
  "stock price",
  "weather forecast",
];

// Bare greetings / filler with no security question to answer.
const TRIVIAL_MESSAGES = new Set([
  "hi",
  "hey",
  "hello",
  "yo",
  "sup",
  "hiya",
  "hello there",
  "test",
  "ok",
  "thanks",
  "thank you"
]);

const INJECTION_REPLY =
  "I can only help with your own home network's security, and I can't change my " +
  "instructions or share internal prompts. Happy to help with your router, Wi-Fi, " +
  "remote access, firmware, or a finding from your dashboard.";

const TRIVIAL_REPLY =
  "Hi! I can help you understand and improve your home network's security. What would " +
  "you like to look at — Wi-Fi, remote access, firmware, or a specific finding from " +
  "your dashboard?";

const OFFTOPIC_REPLY =
  "That's outside what I can help with — I focus on home-network and router security. " +
  "Want to look at your Wi-Fi security, remote access, or a specific dashboard finding instead?";

function matchesOutOfScope(lower: string): boolean {
  return OUT_OF_SCOPE_KEYWORDS.some((keyword) => {
    const pattern = new RegExp(`\\b${keyword.replace(/\s+/g, "\\s+")}\\b`, "i");
    return pattern.test(lower);
  });
}

// Classify a chat message. Returns a canned reply (so the caller can answer without
// the LLM) or null to proceed to the agent. Order matters: block injections first,
// then trivial filler, then off-topic.
export function screenChatMessage(rawMessage: string): ChatScreenResult {
  const message = rawMessage.trim();
  if (!message) {
    return { category: "trivial", reply: TRIVIAL_REPLY };
  }

  if (INJECTION_PATTERNS.some((pattern) => pattern.test(message))) {
    return { category: "injection", reply: INJECTION_REPLY };
  }

  const lower = message.toLowerCase();
  const hasLetters = /[a-z]/i.test(message);
  if (!hasLetters || message.length <= 2 || TRIVIAL_MESSAGES.has(lower)) {
    return { category: "trivial", reply: TRIVIAL_REPLY };
  }

  if (matchesOutOfScope(lower)) {
    return { category: "offtopic", reply: OFFTOPIC_REPLY };
  }

  return null;
}
