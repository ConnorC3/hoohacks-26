/**
 * Simple in-memory sliding-window rate limiter.
 * Suitable for a single-instance deployment (dev / demo).
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 5 })
 *   const { allowed, retryAfterMs } = limiter.check(ip)
 */

interface RateLimiterOptions {
  /** Window size in milliseconds */
  windowMs: number
  /** Maximum requests allowed within the window */
  max: number
}

interface CheckResult {
  allowed: boolean
  /** How many ms until the oldest request falls outside the window (0 if allowed) */
  retryAfterMs: number
}

export function createRateLimiter({ windowMs, max }: RateLimiterOptions) {
  // ip → sorted list of request timestamps
  const store = new Map<string, number[]>()

  return {
    check(ip: string): CheckResult {
      const now = Date.now()
      const cutoff = now - windowMs

      const timestamps = (store.get(ip) ?? []).filter((t) => t > cutoff)

      if (timestamps.length >= max) {
        const retryAfterMs = windowMs - (now - timestamps[0])
        store.set(ip, timestamps)
        return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) }
      }

      timestamps.push(now)
      store.set(ip, timestamps)
      return { allowed: true, retryAfterMs: 0 }
    },
  }
}
