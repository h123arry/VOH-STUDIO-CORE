import { invokeLLM } from "../_core/llm";
import { resolveModel } from "../models/model-router";
import { z } from "zod";

export const planSchema = z.object({
  summary: z.string().min(1),
  steps: z.array(z.object({ phase: z.string().min(1), title: z.string().min(1), agent: z.string().min(1) })).min(1).max(12),
});

export type StructuredPlan = z.infer<typeof planSchema>;

const fallbackPlan = (objective: string): StructuredPlan => ({
  summary: `Prepare a bounded workspace for: ${objective}`,
  steps: [
    { phase: "inspect", title: "Inspect the current workspace and project constraints", agent: "architect" },
    { phase: "build", title: "Create or update the requested project files", agent: "frontend" },
    { phase: "test", title: "Run the available project verification commands", agent: "qa" },
    { phase: "inspect", title: "Review evidence and report the verified result", agent: "documentation" },
  ],
});

const parseJson = (content: unknown) => {
  if (typeof content !== "string" || !content.trim()) return null;
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(cleaned); } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
    }
    return null;
  }
};

export async function createPlan(objective: string): Promise<{ plan: StructuredPlan; source: "model" | "deterministic"; modelId?: string; error?: string }> {
  const route = await resolveModel("reasoning");
  if (!route.available || !route.modelId) return { plan: fallbackPlan(objective), source: "deterministic", error: route.error ?? "No reasoning model is available" };
  try {
    const response = await invokeLLM({
      model: route.modelId,
      max_tokens: 900,
      messages: [
        { role: "system", content: "You are VOH STUDIO's planning agent. Return only a compact JSON plan. Do not expose hidden reasoning. Use phases from inspect, build, run, test, debug, patch, rebuild, retest." },
        { role: "user", content: `Create an implementation plan for this user objective: ${objective}` },
      ],
      response_format: { type: "json_schema", json_schema: { name: "voh_task_plan", strict: true, schema: { type: "object", additionalProperties: false, properties: { summary: { type: "string" }, steps: { type: "array", minItems: 1, maxItems: 12, items: { type: "object", additionalProperties: false, properties: { phase: { type: "string" }, title: { type: "string" }, agent: { type: "string" } }, required: ["phase", "title", "agent"] } } }, required: ["summary", "steps"] } } },
    });
    const content = response.choices?.[0]?.message?.content;
    const parsed = planSchema.safeParse(parseJson(content));
    if (!parsed.success) return { plan: fallbackPlan(objective), source: "deterministic", modelId: route.modelId, error: "Model returned an invalid structured plan" };
    return { plan: parsed.data, source: "model", modelId: route.modelId };
  } catch (error) {
    return { plan: fallbackPlan(objective), source: "deterministic", modelId: route.modelId, error: error instanceof Error ? error.message : "Model planning failed" };
  }
}
