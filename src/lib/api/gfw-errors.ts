import "server-only";
import { GfwError } from "@/lib/gfw/http";
import { apiError } from "./guard";

/** Petakan GfwError ke kode internal PRD §12; body upstream mentah tidak diteruskan. */
export function gfwErrorResponse(error: unknown) {
  if (!(error instanceof GfwError)) throw error;
  switch (error.code) {
    case "INVALID_REQUEST":
      return apiError(400, "INVALID_INPUT", error.message);
    case "NOT_FOUND":
      return apiError(404, "NOT_FOUND", "Data tidak ditemukan di sumber.");
    case "RATE_LIMITED":
    case "BUDGET_EXCEEDED":
      return apiError(429, "RATE_LIMITED", "Batas permintaan ke sumber tercapai. Coba lagi nanti.", true);
    default:
      return apiError(503, "SOURCE_UNAVAILABLE", "Sumber data belum dapat diakses.", error.retryable);
  }
}
