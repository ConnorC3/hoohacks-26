import { GoogleGenAI } from "@google/genai"
import { NextRequest, NextResponse } from "next/server"
import { createRateLimiter } from "@/lib/rateLimit"

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
const limiter = createRateLimiter({ windowMs: 60_000, max: 10 })

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"
  const { allowed, retryAfterMs } = limiter.check(ip)
  if (!allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${Math.ceil(retryAfterMs / 1000)}s.` },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    )
  }

  try {
    const { prompt, sectors } = await req.json()
    if (!prompt || !sectors?.length) {
      return NextResponse.json({ error: "prompt and sectors are required" }, { status: 400 })
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are a macro-economic analyst. A user has described a market scenario and you must translate it into sector-level price shocks for a stock portfolio simulator.

The user's portfolio contains stocks from these GICS sectors: ${sectors.join(", ")}.

User scenario: "${prompt}"

Analyze this scenario and return a JSON object with exactly two fields:
1. "explanation": a 2-3 sentence plain-English analysis of the scenario
2. "sectorShocks": an object mapping affected GICS sector names (from the list above only) to percentage shock values (e.g. -12 means -12%, not -0.12). Only include sectors that are meaningfully affected. Be realistic — most shocks are in the -20% to +20% range.

Return only valid JSON, no markdown.`,
      config: {
        responseMimeType: "application/json",
        temperature: 0,
      },
    })

    const text = (response as any).candidates?.[0]?.content?.parts?.[0]?.text ?? (response as any).text
    if (!text) return NextResponse.json({ error: "Empty response from model" }, { status: 500 })

    const result = JSON.parse(text)
    return NextResponse.json(result)
  } catch (e: any) {
    console.error("[/api/scenario]", e)
    const message = e?.message ?? "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
