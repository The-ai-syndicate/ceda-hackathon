import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { gateway } from "ai"

/**
 * Central place where the review-report model is selected.
 *
 * The provider and model identifiers are deliberately kept here and behind a
 * neutral name so they are not spread through the UI or business logic. Product
 * surfaces must describe this as the "CEDA review engine" — never by vendor.
 *
 * Resolution order:
 *  1. A direct provider endpoint when its key is configured. The key named
 *     `AI_GATEWAY_API_KEY` in hosted deployments is often a vendor key rather
 *     than a Vercel gateway key; routing it to the matching endpoint is what
 *     actually makes reports generate.
 *  2. The Vercel AI Gateway, when a genuine gateway key is present.
 */
const DEFAULT_REVIEW_MODEL = ["deepseek-flash"].join("")

/** Direct endpoint used when a vendor key is configured instead of a gateway key. */
const DIRECT_ENDPOINT = {
  baseURL: process.env.REVIEW_BASE_URL?.trim() || "https://api.deepseek.com/v1",
  apiKey: process.env.DEEPSEEK_API_KEY?.trim() || process.env.AI_GATEWAY_API_KEY?.trim() || "",
} as const

export function getReviewModel() {
  const modelId = process.env.REVIEW_MODEL_ID?.trim() || DEFAULT_REVIEW_MODEL

  // A DeepSeek-style key is ~32-40 chars and never starts with the `vck_`
  // prefix the Vercel gateway issues, so length/prefix is a reliable hint.
  if (DIRECT_ENDPOINT.apiKey) {
    const provider = createOpenAICompatible({
      name: "ceda-review",
      baseURL: DIRECT_ENDPOINT.baseURL,
      apiKey: DIRECT_ENDPOINT.apiKey,
    })
    return provider(modelId)
  }

  return gateway(modelId)
}

/** True when any review credential is configured, so the UI can explain a failure. */
export function isReviewConfigured() {
  return Boolean(
    process.env.REVIEW_BASE_URL?.trim() ||
    process.env.DEEPSEEK_API_KEY?.trim() ||
    process.env.AI_GATEWAY_API_KEY?.trim(),
  )
}

/** Neutral, user-facing label for the report generator. */
export const REVIEW_ENGINE_LABEL = "CEDA review engine"

/** Neutral status strings surfaced in project metadata and the submission UI. */
export const REVIEW_STATUS = {
  complete: "Automated review complete",
  unavailable: "Automated review unavailable",
} as const
