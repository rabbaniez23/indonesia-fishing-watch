import "server-only";
import { z } from "zod";
import { apiError } from "@/lib/api/guard";
import { FindingError } from "./service";

export function findingErrorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return apiError(400, "INVALID_INPUT", error.issues[0]?.message ?? "Input tidak valid.");
  }
  if (error instanceof FindingError) {
    switch (error.code) {
      case "NOT_FOUND":
        return apiError(404, "NOT_FOUND", error.message);
      case "CONFLICT":
        return apiError(409, "CONFLICT", error.message);
      default:
        return apiError(400, "INVALID_INPUT", error.message);
    }
  }
  throw error;
}
