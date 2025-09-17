import api from "./axios";
import { z } from "zod";

// Token schema
export const TokenPair = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional()
});
export type TokenPair = z.infer<typeof TokenPair>;

// 🔑 Fix: send JSON body instead of params
export async function login(email: string, password: string) {
  const res = await api.post("/v1/auth/login",
    { email, password }, // <-- JSON body
    { headers: { "Content-Type": "application/json" } }
  );
  return TokenPair.parse(res.data);
}

// Suggestion schema
export const Suggestion = z.object({
  staffId: z.number(),
  score: z.number(),
  reasoning: z.string()
});

// Suggest assignments
export async function suggestAssignments(payload: {
  startUtc: string;
  endUtc: string;
  unitId: number;
  requiredCredential: "RN" | "LPN" | "CNA";
}) {
  const res = await api.post("/api/v1/scheduler/suggest-assignments", payload, {
    headers: { "Content-Type": "application/json" }
  });
  return z.array(Suggestion).parse(res.data);
}
