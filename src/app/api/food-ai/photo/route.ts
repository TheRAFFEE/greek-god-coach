import { handleFoodAiScanRequest } from "@/lib/food-ai-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleFoodAiScanRequest(request, "Food Photo Scan");
}
