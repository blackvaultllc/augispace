/**
 * Redact anything that looks like a credential from a diagnostic message.
 * Used by server routes before any error text is returned to a client.
 */
export function redact(text: string) {
  return text
    .replace(/postgres(ql)?:\/\/[^\s]+/gi, "postgres://<redacted>")
    .replace(
      /(password|token|secret|key|authorization)\s*[:=]\s*\S+/gi,
      "$1: <redacted>",
    )
    .replace(/sk_live_\w+|sk_test_\w+|whsec_\w+|key_[\w-]+/gi, "<redacted>")
    .slice(0, 300);
}
