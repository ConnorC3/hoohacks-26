import { GoogleGenAI } from "@google/genai"
import { NextRequest, NextResponse } from "next/server"
import { createRateLimiter } from "@/lib/rateLimit"

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
const limiter = createRateLimiter({ windowMs: 60_000, max: 10 })

export interface HoldingMetric {
  ticker: string
  name: string
  weightPct: number
  value: number
  annualisedVolPct: number
}

export interface SectorBreakdown {
  sector: string
  weightPct: number
  tickers: string[]
}

export interface CorrelatedPair {
  from: string
  to: string
  fromName: string
  toName: string
  strength: number
}

export interface RiskMetrics {
  totalValue: number
  portfolioVolPct: number
  holdings: HoldingMetric[]
  sectorBreakdown: SectorBreakdown[]
  topPairs: CorrelatedPair[]
  mostExposedTicker: string | null
  mostExposedName: string | null
}

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
    const { metrics }: { metrics: RiskMetrics } = await req.json()
    if (!metrics) {
      return NextResponse.json({ error: "metrics required" }, { status: 400 })
    }

    const holdingsList = metrics.holdings
      .map((h) =>
        `  - ${h.ticker} (${h.name}): ${h.weightPct.toFixed(1)}% of portfolio, ` +
        `value $${h.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}, ` +
        `annualised volatility ${h.annualisedVolPct.toFixed(1)}%`
      )
      .join("\n")

    const sectorList = metrics.sectorBreakdown
      .map((s) => `  - ${s.sector}: ${s.weightPct.toFixed(1)}% (${s.tickers.join(", ")})`)
      .join("\n")

    const pairsList = metrics.topPairs
      .map((p) =>
        `  - ${p.fromName} (${p.from}) → ${p.toName} (${p.to}): ` +
        `VAR influence strength ${p.strength.toFixed(3)}`
      )
      .join("\n")

    const exposedLine = metrics.mostExposedTicker
      ? `MOST NETWORK-EXPOSED HOLDING: ${metrics.mostExposedName} (${metrics.mostExposedTicker}) — ` +
        `this stock is statistically most influenced by movements in the rest of the portfolio.`
      : ""

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are a portfolio risk analyst. Analyse the following portfolio and provide an intuitive, specific risk assessment that explains *why* each risk factor matters for this particular set of holdings. Avoid generic statements — always name the specific stocks or sectors involved and explain the real-world mechanism that would cause the risk to materialise.

PORTFOLIO OVERVIEW:
Total value: $${metrics.totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Estimated annualised volatility (weighted average of individual vols): ${metrics.portfolioVolPct.toFixed(1)}%

HOLDINGS:
${holdingsList}

SECTOR CONCENTRATION:
${sectorList}

TOP STATISTICAL DEPENDENCIES (VAR model — how strongly one stock's past returns predict another's):
${pairsList}

${exposedLine}

Return a JSON object with exactly three fields:
1. "riskLevel": one of "Low", "Medium", or "High"
2. "summary": one sentence explaining the overall risk level and the single biggest reason for it — reference specific tickers or sectors by name
3. "bullets": an array of 3-4 strings. Each bullet must:
   - Name the specific stocks or sectors involved (e.g. "AAPL and MSFT together make up X% of the portfolio")
   - Explain what the risk IS and why it matters (what real-world event or market condition would trigger it)
   - Be written in plain English a non-expert investor can understand
   - NOT just repeat raw numbers — interpret what they mean for the investor
4. Be realistic and calibrated with your assessment. This portfolio contains only domestic US equities — the absence of bonds, international stocks, or alternative assets is normal for a stock-only portfolio and should NOT itself be treated as a risk factor. Judge the portfolio on its own terms:
   - "Low risk": well-diversified across 5+ sectors, no single stock over 20% of portfolio, weighted average annualised volatility under 25%
   - "Medium risk": moderate concentration (1-2 sectors dominate, or one stock over 25%), or weighted volatility 25-35%
   - "High risk": heavily concentrated (one stock over 40%, or 60%+ in one sector), or weighted volatility above 35%
   A 100-stock portfolio spread across all S&P 500 sectors should almost never score "High". Weight positions matter — a volatile stock at 1% of the portfolio is a minor concern, not a major risk.

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
    console.error("[/api/risk-analysis]", e)
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 })
  }
}
