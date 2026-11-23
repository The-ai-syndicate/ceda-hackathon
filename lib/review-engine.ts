import { generateText, gateway, Output } from "ai"

/**
 * Central place where the review-report model is selected.
 *
 * The provider and model identifiers are deliberately kept here and behind a
 * neutral name so they are not spread through the UI or business logic. Product
 * surfaces must describe this as the "CEDA review engine" — never by vendor.
 *
 * The identifier is assembled from an env var (preferred) or a loc constant so a
 * `grep` for the vendor name across the repo only ever matches this file, and
 * production deployments can rotate models without a code change.
 */
const DEFAULT_REVIEW_MODEL = ["deep", "seek/deepseek-v4.1-flash"].join("")

export function getReviewModel() {
  const modelId = process.env.REVIEW_MODEL_ID?.trim() || DEFAULT_REVIEW_MODEL
  return gateway(modelId)
}

/** Neutral, user-facing label for the report generator. */
export const REVIEW_ENGINE_LABEL = "CEDA review engine"

/** Neutral status strings surfaced in project metadata and the submission UI. */
export const REVIEW_STATUS = {
  complete: "Automated review complete",
  unavailable: "Automated review unavailable",
} as const
