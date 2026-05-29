import { NextResponse } from "next/server";
import { getScanProviderConfig, mockScanNutritionImage, parseVisionProviderScanResult, validateScanResultForReview } from "@/lib/coach-engine";
import type { ScanMode } from "@/lib/types";

export const runtime = "nodejs";

type ScanRequest = {
  mode?: ScanMode;
  fileName?: string;
  imageDataUrl?: string;
};

const schemaText = `Return ONLY valid JSON with these keys. For Nutrition Label Scan: detectedName, servingSize, servingsPerContainer, calories, protein, carbs, fat, fiber, sodium, sugar, confidence. For Food Photo Scan: detectedName, foodsDetected array, portionEstimate, calories, protein, carbs, fat, confidence. Use numbers only for nutrition fields. Confidence must be 0-100. If unreadable, return low confidence and zeros rather than inventing.`;

function jsonError(message: string, status = 400, code = "scan_error") {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

function parseJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) throw new Error("Vision provider did not return a JSON object.");
  return JSON.parse(trimmed.slice(first, last + 1)) as Record<string, unknown>;
}

async function runOpenAIScan(input: Required<Pick<ScanRequest, "mode" | "imageDataUrl">> & { fileName?: string }, apiKey: string, model: string) {
  const labelPrompt = input.mode === "Nutrition Label Scan"
    ? "Extract nutrition label facts from this image. Do not estimate missing label fields unless clearly visible."
    : "Estimate food photo macros from visible foods and portions. Be conservative and include detected foods and portion estimate.";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a careful nutrition scan parser. You never silently add macros; you only return reviewable estimates." },
        { role: "user", content: [
          { type: "text", text: `${labelPrompt}\nMode: ${input.mode}\nFile name: ${input.fileName ?? "unknown"}\n${schemaText}` },
          { type: "image_url", image_url: { url: input.imageDataUrl } },
        ] },
      ],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI scan failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI scan returned no content.");
  const payload = parseJsonObject(content);
  const result = parseVisionProviderScanResult({ mode: input.mode, provider: "openai-vision", payload });
  return { result, issues: validateScanResultForReview(result) };
}

export async function POST(request: Request) {
  let body: ScanRequest;
  try {
    body = await request.json() as ScanRequest;
  } catch {
    return jsonError("Invalid JSON request body.");
  }

  const mode = body.mode;
  if (mode !== "Nutrition Label Scan" && mode !== "Food Photo Scan") return jsonError("Unsupported scan mode.");

  const config = getScanProviderConfig(process.env);
  if (config.provider === "mock") {
    const result = mockScanNutritionImage({ mode, fileName: body.fileName });
    return NextResponse.json({ ok: true, provider: "mock", model: config.model, result, issues: validateScanResultForReview(result), warning: "Mock deterministic scan provider is active. Set GREEK_GOD_SCAN_PROVIDER=openai and OPENAI_API_KEY to use real vision." });
  }

  if (!body.imageDataUrl?.startsWith("data:image/")) return jsonError("Upload an image before running the real vision scan.", 400, "missing_image");

  try {
    const scan = await runOpenAIScan({ mode, imageDataUrl: body.imageDataUrl, fileName: body.fileName }, process.env.OPENAI_API_KEY!, config.model);
    return NextResponse.json({ ok: true, provider: "openai", model: config.model, ...scan });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Vision scan API failure.", 502, "api_failure");
  }
}
