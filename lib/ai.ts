import {
  getIntegrationSecret,
  INTEGRATION_KEYS,
} from "@/lib/integration-secrets";

/**
 * AI model configuration.
 *
 * All AUGI AI features (copilot, evidence explanations, image analyst) route
 * through the Vercel AI Gateway using gateway model strings. The gateway key
 * is resolved in this order:
 *   1. Encrypted value from the owner's admin Integrations panel
 *   2. AI_GATEWAY_API_KEY environment variable
 *
 * One key powers every AI feature. Add it in /admin -> Integrations.
 */

export const AI_MODELS = {
  copilot: "google/gemini-3-flash",
  domainAnalyst: "google/gemini-3-flash",
  imageAnalyst: "google/gemini-3-flash",
} as const;

export async function ensureAiCredentials(): Promise<boolean> {
  if (process.env.AI_GATEWAY_API_KEY) return true;
  const secret = await getIntegrationSecret(INTEGRATION_KEYS.aiGateway).catch(
    () => null,
  );
  if (!secret) return false;
  process.env.AI_GATEWAY_API_KEY = secret;
  return true;
}
