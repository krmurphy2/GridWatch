// Minimal, dependency-free email check — good enough to catch typos before we
// store a notification address. Not meant to be RFC-complete.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string | null | undefined): boolean {
  return typeof value === "string" && EMAIL_RE.test(value.trim());
}
