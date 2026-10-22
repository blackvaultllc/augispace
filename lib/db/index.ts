import { getCloudflareContext } from '@opennextjs/cloudflare'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

type HyperdriveBindings = {
  HYPERDRIVE?: {
    connectionString?: string
  }
}

let poolInstance: Pool | undefined

function createPool(): Pool {
  let hyperdriveConnectionString: string | undefined
  let contextError: unknown

  try {
    const context = getCloudflareContext()
    const workerEnv = context.env as unknown as HyperdriveBindings
    hyperdriveConnectionString = workerEnv.HYPERDRIVE?.connectionString
  } catch (error) {
    contextError = error
  }

  // In production runtime, fail closed if the Worker binding is missing.
  // DATABASE_URL is retained only for local development and build-time work.
  const mayUseDatabaseUrl =
    process.env.NODE_ENV !== 'production' ||
    process.env.NEXT_PHASE === 'phase-production-build'

  const connectionString =
    hyperdriveConnectionString ??
    (mayUseDatabaseUrl ? process.env.DATABASE_URL : undefined)

  if (!connectionString) {
    const detail = contextError instanceof Error ? ` ${contextError.message}` : ''
    throw new Error(
      `Database unavailable: Cloudflare HYPERDRIVE.connectionString was not available. ` +
        `Production Worker requests must use the HYPERDRIVE binding; DATABASE_URL is not a production fallback.${detail}`,
    )
  }

  return new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  })
}

function getPool(): Pool {
  if (!poolInstance) poolInstance = createPool()
  return poolInstance
}

// Preserve the existing pool.query(), pool.connect(), and Drizzle call sites,
// while delaying binding access until an actual request uses the database.
export const pool = new Proxy({} as unknown as Pool, {
  get(_target, property) {
    if (property === 'then') return undefined
    const actualPool = getPool()
    const value = Reflect.get(actualPool, property, actualPool) as unknown
    return typeof value === 'function' ? value.bind(actualPool) : value
  },
  getPrototypeOf() {
    return Pool.prototype
  },
})

export const db = drizzle(pool, { schema })