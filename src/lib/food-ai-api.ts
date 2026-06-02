import { NextResponse } from "next/server";
import { getScanProviderConfig, mockScanNutritionImage, parseVisionProviderScanResult, validateScanResultForReview } from "./coach-engine";
import type { ScanMode } from "./types";

export type FoodAiScanRequest = {
  fileName?: string;
  imageDataUrl?: string;
};

const schemaText = `Return ONLY valid JSON with these keys. For Nutrition Label Scan: detectedName, servingSize, servingsPerContainer, calories, protein, carbs, fat, fiber, sodium, sugar, confidence. For Food Photo Scan: detectedName, foodsDetected array, portionEstimate, calories, protein, carbs, fat, fiber, sodium, confidence. Use numbers only for nutrition fields. Confidence must be 0-100. If unreadable, return low confidence and zeros rather than inventing.`;

function jsonError(message: string, status = 400, code = "food_ai_error") {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

function parseJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) throw new Error("Vision provider did not return a JSON object.");
  return JSON.parse(trimmed.slice(first, last + 1)) as Record<string, unknown>;
}

async function runOpenAiFoodAiScan(input: Required<Pick<FoodAiScanRequest, "imageDataUrl">> & { mode: ScanMode; fileName?: string }, apiKey: string, model: string) {
  const prompt = input.mode === "Nutrition Label Scan"
    ? "OCR the nutrition facts label from this image and extract per-serving label fields. Do not estimate missing fields unless visible."
    : "Estimate visible meal photo macros. Be conservative, include detected foods, and return editable review values.";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are FOOD_AI_V1. Return reviewable nutrition data only; never persist anything." },
        { role: "user", content: [
          { type: "text", text: `${prompt}\nMode: ${input.mode}\nFile name: ${input.fileName ?? "unknown"}\n${schemaText}` },
          { type: "image_url", image_url: { url: input.imageDataUrl } },
        ] },
      ],
      temperature: 0,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI FOOD_AI_V1 scan failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI FOOD_AI_V1 scan returned no content.");
  const result = parseVisionProviderScanResult({ mode: input.mode, provider: "openai-vision", payload: parseJsonObject(content) });
  return { result, issues: validateScanResultForReview(result) };
}

export async function handleFoodAiScanRequest(request: Request, mode: ScanMode) {
  let body: FoodAiScanRequest;
  try {
    body = await request.json() as FoodAiScanRequest;
  } catch {
    return jsonError("Invalid JSON request body.");
  }
  const config = getScanProviderConfig(process.env);
  if (config.provider === "mock") {
    const result = mockScanNutritionImage({ mode, fileName: body.fileName });
    return NextResponse.json({ ok: true, mode, provider: "mock", model: config.model, result, issues: validateScanResultForReview(result), warning: "Mock deterministic FOOD_AI_V1 provider is active. Set GREEK_GOD_SCAN_PROVIDER=openai and OPENAI_API_KEY for real OCR/vision." });
  }
  if (!body.imageDataUrl?.startsWith("data:image/")) return jsonError("Upload an image before running FOOD_AI_V1.", 400, "missing_image");
  try {
    const scan = await runOpenAiFoodAiScan({ mode, imageDataUrl: body.imageDataUrl, fileName: body.fileName }, process.env.OPENAI_API_KEY!, config.model);
    return NextResponse.json({ ok: true, mode, provider: "openai", model: config.model, ...scan });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "FOOD_AI_V1 API failure.", 502, "api_failure");
  }
}
