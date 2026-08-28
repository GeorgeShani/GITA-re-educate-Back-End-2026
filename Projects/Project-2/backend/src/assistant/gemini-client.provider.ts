import { GoogleGenAI } from '@google/genai';

export const GEMINI_CLIENT_TOKEN = Symbol('GEMINI_CLIENT');

// Constructed lazily and only when GEMINI_API_KEY is set — same
// conditional-provider shape as STRIPE_CLIENT_TOKEN/RESEND_CLIENT_TOKEN
// (S9/S4), so a dev/test boot never needs a real Gemini key.
// AssistantService throws a clear error at call time if this is
// undefined, rather than failing app bootstrap.
//
// Source: https://github.com/googleapis/js-genai (README quickstart,
// verified against the installed @google/genai@2.19.0):
//   import {GoogleGenAI} from '@google/genai';
//   const ai = new GoogleGenAI({apiKey: GEMINI_API_KEY});
export function createGeminiClient(
  apiKey: string | undefined,
): GoogleGenAI | undefined {
  if (!apiKey) return undefined;
  return new GoogleGenAI({ apiKey });
}
