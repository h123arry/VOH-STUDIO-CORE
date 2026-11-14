import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_core/llm", () => ({ listLLMModels: vi.fn() }));

import { listLLMModels } from "../_core/llm";
import { resolveModel } from "./model-router";

describe("model role routing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("recognizes GPT-6 as a reasoning model", async () => {
    vi.mocked(listLLMModels).mockResolvedValue({ data: [{ id: "gpt-6" }] } as never);
    const route = await resolveModel("reasoning");
    expect(route.modelId).toBe("gpt-6");
    expect(route.available).toBe(true);
  });
});
