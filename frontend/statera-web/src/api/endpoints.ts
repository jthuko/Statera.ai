import api from "./axios";
import { z } from "zod";
export const TokenPair = z.object({ accessToken:z.string(), refreshToken:z.string() });
export type TokenPair = z.infer<typeof TokenPair>;
export async function login(email:string, password:string){ const res = await api.post("/api/v1/auth/login", null, { params:{ email, password } }); return TokenPair.parse(res.data); }
export const Suggestion = z.object({ staffId:z.number(), score:z.number(), reasoning:z.string() });
export async function suggestAssignments(payload:{ startUtc:string; endUtc:string; unitId:number; requiredCredential:"RN"|"LPN"|"CNA"; }){ const res = await api.post("/api/v1/scheduler/suggest-assignments", payload); return z.array(Suggestion).parse(res.data); }
