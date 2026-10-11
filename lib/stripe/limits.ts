/**
 * Per-request limits for Stripe calls whose duration matters to the caller:
 * everything checkout does while holding its lock, and the webhook's read.
 * The SDK defaults (80 seconds, one retry) allow a single call to run for
 * minutes.
 */
export const STRIPE_REQUEST_LIMITS = { timeout: 10_000, maxNetworkRetries: 1 } as const

/** The SDK version the budget below was derived from. */
export const STRIPE_SDK_VERSION_FOR_BUDGET = '14.25.0'

/**
 * Longest the SDK waits before a retry under these limits. Read from
 * stripe@14.25.0 (cjs/RequestSender.js, _getSleepTimeInMS): the first retry
 * waits the initial delay of 0.5 seconds. A Retry-After header can raise that
 * to as much as 60 seconds, but only when the value is an integer, and the
 * Node HTTP client passes the header through as a string, so in this version
 * it never applies. Check this again when the SDK is upgraded: if Retry-After
 * starts to apply, one call can outlast the checkout lock lease.
 */
const RETRY_DELAY_MS = 500

/** Longest one call can take locally: every attempt timing out, plus the wait before each retry. */
export const STRIPE_CALL_BUDGET_MS =
  STRIPE_REQUEST_LIMITS.timeout * (STRIPE_REQUEST_LIMITS.maxNetworkRetries + 1) + STRIPE_REQUEST_LIMITS.maxNetworkRetries * RETRY_DELAY_MS
