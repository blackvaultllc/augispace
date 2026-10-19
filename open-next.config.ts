import { defineCloudflareConfig } from '@opennextjs/cloudflare'

// Default config: no incremental cache binding, so ISR/fetch revalidation (for example /api/public-threat-trend)
// refetches instead of serving a cached copy. Add an R2 or KV cache here later if that matters.
export default defineCloudflareConfig()
