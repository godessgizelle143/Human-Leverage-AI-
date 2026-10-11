import OpenAI from 'openai'

let openaiClient: OpenAI | null = null

/**
 * Every OpenAI request goes through this client, so these two values bound
 * all of them. The generation routes have a 60-second limit (maxDuration);
 * the SDK defaults (10 minutes, 2 retries) let a slow request outlive the
 * route, which then ends without recording the failure or returning the
 * reserved credit.
 *
 * 45 seconds with no retries leaves 15 seconds of the route for the work
 * before the request and for recording the result afterwards. Retries stay at
 * zero because the SDK waits for a Retry-After of up to 60 seconds before
 * each one (openai 4.104.0, core.js retryRequest), which no budget under a
 * 60-second route can absorb. Check both again if the SDK is upgraded or a
 * route limit changes.
 */
export const OPENAI_TIMEOUT_MS = 45_000
export const OPENAI_MAX_RETRIES = 0

export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: OPENAI_TIMEOUT_MS,
      maxRetries: OPENAI_MAX_RETRIES,
    })
  }
  return openaiClient
}

export const INTERVIEW_SYSTEM_PROMPT = `You are a professional business interview assistant for Human Leverage AI. 
Your role is to conduct a structured interview to gather comprehensive information about a user's business.
Be professional, warm, and encouraging. Keep responses concise.
After each answer, briefly acknowledge it (1-2 sentences), then ask the next question.`

export const GENERATION_SYSTEM_PROMPT = `You are a professional business content generator for Human Leverage AI.
Based on interview answers, generate comprehensive, conversion-focused business content.
Match the brand tone described in the interview. Be creative, professional, and specific.
Format output with clear section headers.`
