import { describe, expect, it } from "vitest";
import { TOOL_REGISTRY, toolsForAgent } from "./tools/registry";
import { getTemplate, listTemplates } from "./templates/registry";
import { classifyFailure, recoverySummary } from "./orchestrator/recovery";
import { buildExecutionPlan, classifyComplexity, executionProfile } from "./orchestrator/planning-engine";
import { evaluateQuality } from "./quality/quality-engine";
import { CAPABILITY_REGISTRY } from "./capabilities/registry";
import { SKILL_REGISTRY, skillsForObjective } from "./skills/registry";
import { CAPABILITY_MATRIX } from "./intelligence/competitive-matrix";
import { takeoverPlan, validateProjectInputs } from "./intelligence/input-analysis";
import { visualChangePlan } from "./intelligence/visual-loop";
import { deploymentPlan, DEPLOYMENT_PROVIDERS } from "./lifecycle/deployment-engine";
import { githubAvailability } from "./lifecycle/github-adapter";
import { inferProductBlueprint, productGaps, productScore } from "./intelligence/product-intelligence";
import { engineeringBrief, engineeringHealth, maintenancePlan } from "./intelligence/engineering-intelligence";
import { buildCreationPlan, explainCreationResult, inferCreationMode, matchCapabilities } from "./intelligence/creation-engine";
import { validateGeneratedProjectFiles } from "./platform/llm-client";
import { buildAttachmentContext, isSupportedContextFile, MAX_ATTACHMENT_CONTEXT_CHARS, MAX_FILE_BYTES } from "../client/src/lib/task-context";
import { executionModePolicy } from "./domain/execution-mode";
import { taskActivity } from "../client/src/lib/studio-types";
import { containsSensitiveValue } from "./domain/project-memory";

describe("VOH core policies", () => {
  it("exposes only bounded tools to QA", () => {
    const qaTools = toolsForAgent("qa").map(tool => tool.name);
    expect(qaTools).toContain("project.build");
    expect(qaTools).toContain("project.test");
    expect(qaTools).not.toContain("project.deploy");
  });
  it("keeps production deployment approval-gated", () => {
    expect(TOOL_REGISTRY.find(tool => tool.name === "project.deploy")?.executorStatus).toBe("approval_required");
  });
  it("creates a real browser workspace template", () => {
    const template = getTemplate("website");
    expect(template).toBeDefined();
    const files = template!.files({ id: 1, ownerId: 1, name: "Atlas", slug: "atlas", description: "A site", projectType: "website", lifecycle: "active", workspacePath: "workspace-data/project-1", activeTaskId: null, settings: null, createdAt: new Date(), updatedAt: new Date() }, "Create a simple website");
    expect(files.map(file => file.path)).toEqual(expect.arrayContaining(["package.json", "index.html", "src/main.js", "scripts/build.mjs", "scripts/test.mjs"]));
    expect(files.find(file => file.path === "scripts/build.mjs")?.content).toContain("fs.cpSync('src', 'dist/src', { recursive: true })");
  });
  it("creates a playable browser game with a tested animation loop", () => {
    const template = getTemplate("game");
    expect(template?.name).toBe("2D browser game");
    const files = template!.files({ id: 1, ownerId: 1, name: "Orbit", slug: "orbit", description: "A game", projectType: "game", lifecycle: "active", workspacePath: "workspace-data/project-1", activeTaskId: null, settings: null, createdAt: new Date(), updatedAt: new Date() }, "Collect the sparks");
    expect(files.map(file => file.path)).toEqual(expect.arrayContaining(["index.html", "src/game.js", "src/main.js", "src/styles.css", "scripts/build.mjs", "scripts/test.mjs"]));
    expect(JSON.parse(files.find(file => file.path === "package.json")!.content).type).toBe("module");
    expect(files.find(file => file.path === "src/main.js")?.content).toContain("requestAnimationFrame(frame)");
    expect(files.find(file => file.path === "scripts/test.mjs")?.content).toContain("assert.equal(won.status, 'won')");
  });
  it("exposes the executable starters that the new-task composer can select", () => {
    expect(listTemplates().map(template => template.kind)).toEqual(expect.arrayContaining(["website", "web_app", "game", "api", "automation"]));
    expect(listTemplates().every(template => getTemplate(template.kind))).toBe(true);
  });
  it("bounds attached text context and accepts only supported source and document formats", () => {
    const context = buildAttachmentContext([{ name: "notes.md", content: "Project brief" }, { name: "large.txt", content: "x".repeat(MAX_ATTACHMENT_CONTEXT_CHARS * 2) }]);
    expect(context).toContain("Project brief");
    expect(context).toContain("[truncated: attachment context limit reached]");
    expect(context.length).toBeLessThanOrEqual(MAX_ATTACHMENT_CONTEXT_CHARS + 100);
    expect(isSupportedContextFile("design.png")).toBe(false);
    expect(isSupportedContextFile("architecture.md")).toBe(true);
    expect(MAX_FILE_BYTES).toBe(65_536);
  });
  it("limits model-generated files to existing source paths and bounded sizes", () => {
    const available = [{ path: "index.html", content: "" }, { path: "src/main.js", content: "" }, { path: "scripts/build.mjs", content: "" }];
    expect(validateGeneratedProjectFiles({ files: [{ path: "src/main.js", content: "export const app = true;" }] }, available).success).toBe(true);
    expect(validateGeneratedProjectFiles({ files: [{ path: "scripts/build.mjs", content: "process.exit(1)" }] }, available).success).toBe(false);
    expect(validateGeneratedProjectFiles({ files: [{ path: "../package.json", content: "{}" }] }, available).success).toBe(false);
    expect(validateGeneratedProjectFiles({ files: [{ path: "src/main.js", content: "x".repeat(60_001) }] }, available).success).toBe(false);
  });
  it("enforces distinct server-side contracts for the four execution modes", () => {
    expect(executionModePolicy("chat")).toMatchObject({ readOnly: true, requiresProject: true, requiresPlanApproval: false, preserveExistingProject: false });
    expect(executionModePolicy("plan")).toMatchObject({ readOnly: false, requiresProject: true, requiresPlanApproval: true, preserveExistingProject: false });
    expect(executionModePolicy("build")).toMatchObject({ readOnly: false, requiresProject: false, requiresPlanApproval: false, preserveExistingProject: false });
    expect(executionModePolicy("build_more")).toMatchObject({ readOnly: false, requiresProject: true, requiresImplementation: true, preserveExistingProject: true });
  });
  it("rejects credentials and private keys from saved project context", () => {
    expect(containsSensitiveValue("Use React and keep components accessible.")).toBe(false);
    expect(containsSensitiveValue("api_key = sk_test_1234567890abcdefghijklmnop")).toBe(true);
    expect(containsSensitiveValue("secret = exampleValue123456")).toBe(true);
    expect(containsSensitiveValue(["ghp", "A".repeat(36)].join("_"))).toBe(true);
    expect(containsSensitiveValue("-----BEGIN PRIVATE KEY-----")).toBe(true);
  });
  it("derives visible activity from persisted operations and task state", () => {
    const task = { status: "running", currentPhase: "build", executionMode: "build", approvedPlan: null } as Parameters<typeof taskActivity>[0];
    expect(taskActivity(task, [{ eventType: "source.generation.started" } as Parameters<typeof taskActivity>[1][number]]).label).toBe("VOH AI is editing code...");
    expect(taskActivity({ ...task, status: "waiting", executionMode: "plan" }).label).toBe("VOH AI is waiting for plan approval");
    expect(taskActivity({ ...task, status: "failed" }).tone).toBe("danger");
    expect(taskActivity(task, [], [{ status: "started", toolName: "project.install" } as Parameters<typeof taskActivity>[2][number]]).label).toBe("VOH AI is running commands...");
  });
  it("escapes adversarial browser content and does not fake unsupported runtimes", () => {
    const template = getTemplate("website")!;
    const files = template.files({ id: 1, ownerId: 1, name: "<script>alert('x')</script>", slug: "safe", description: "A site", projectType: "website", lifecycle: "active", workspacePath: "workspace-data/project-1", activeTaskId: null, settings: null, createdAt: new Date(), updatedAt: new Date() }, "<img src=x onerror=alert(1)>");
    const html = files.find(file => file.path === "index.html")?.content ?? "";
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(getTemplate("mobile")).toBeUndefined();
  });
  it("classifies and explains a compiler failure", () => {
    expect(classifyFailure("tsc: Cannot find module './router'")).toBe("dependency");
    expect(recoverySummary("build")).toMatch(/build output/i);
  });
  it("routes simple work to a fast path and large work to parallel-safe units", () => {
    expect(classifyComplexity("Build a portfolio landing page")).toBe("simple");
    expect(executionProfile("simple").mode).toBe("fast");
    const plan = buildExecutionPlan("Build a multiplayer social network with realtime collaboration and payments");
    expect(plan.complexity).toBe("large");
    expect(plan.parallelGroups.length).toBeGreaterThan(2);
    expect(plan.units.find(unit => unit.id === "qa")?.dependsOn).toContain("frontend");
  });
  it("scores quality dimensions without claiming a perfect result by default", () => {
    const report = evaluateQuality([{ path: "index.html", size: 120, content: "<html lang='en'><meta name='viewport'><main>Product</main>" }, { path: "src/main.js", size: 80, content: "export const app = true;" }, { path: "src/styles.css", size: 80, content: "display: grid" }], { buildPassed: true, testsPassed: true, retries: 0 });
    expect(report.total).toBeGreaterThan(75);
    expect(report.total).toBeLessThan(100);
  });
  it("keeps capability maturity explicit for mobile, games, and commerce", () => {
    expect(CAPABILITY_REGISTRY.find(capability => capability.key === "mobile")?.maturity).toBe("scaffold");
    expect(CAPABILITY_REGISTRY.find(capability => capability.key === "games")?.maturity).toBe("available");
    expect(CAPABILITY_REGISTRY.find(capability => capability.key === "heavy-games")?.maturity).toBe("scaffold");
    expect(CAPABILITY_REGISTRY.find(capability => capability.key === "commerce")?.maturity).toBe("approval_required");
  });
  it("recommends reusable skills and keeps experimental capabilities explicit", () => {
    expect(skillsForObjective("Build a production-grade accessible React application").map(skill => skill.key)).toEqual(expect.arrayContaining(["production-web", "accessible-interface"]));
    expect(SKILL_REGISTRY.find(skill => skill.key === "mobile-ui")?.maturity).toBe("scaffold");
    expect(CAPABILITY_MATRIX.find(item => item.key === "visual-development-loop")?.status).toBe("experimental");
  });
  it("requires permission for external multimodal inputs and produces a takeover plan", () => {
    expect(validateProjectInputs([{ kind: "website", name: "Reference", source: "https://example.com", permissionConfirmed: false }])[0].accepted).toBe(false);
    const plan = takeoverPlan([{ path: "package.json", size: 120, content: "{\"dependencies\":{}}" }]);
    expect(plan.phases).toContain("detect debt");
    expect(visualChangePlan({ projectId: 1, previewPath: "/", elementHint: "hero button", instruction: "Make this larger" }).stages).toContain("verify");
  });
  it("keeps deployment providers extensible and production preflight-aware", () => {
    expect(DEPLOYMENT_PROVIDERS.map(provider => provider.key)).toEqual(expect.arrayContaining(["static", "frontend", "server", "container", "cloud"]));
    expect(deploymentPlan({ provider: "static", environment: "preview", branch: "feature/checkout" }).status).toBe("adapter_registered");
    expect(() => deploymentPlan({ provider: "static", environment: "production", branch: "main" })).not.toThrow();
  });
  it("never pretends GitHub is connected when the connector is disabled", () => {
    const state = githubAvailability();
    expect(state.enabled).toBe(false);
    expect(state.message).toMatch(/not enabled|blocked/i);
  });
  it("turns vague product ideas into domain-aware blueprints without exposing hidden reasoning", () => {
    const blueprint = inferProductBlueprint("Build a social platform for university students", "web_app");
    expect(blueprint.domain).toBe("social");
    expect(blueprint.functionalRequirements).toEqual(expect.arrayContaining(["profiles and social graph", "notifications, privacy, blocking, and moderation"]));
    expect(blueprint.coreWorkflows).toContain("signup → onboarding → first post → engagement");
    expect(blueprint).not.toHaveProperty("chainOfThought");
  });
  it("backs product scores and release readiness with identifiable findings", () => {
    const blueprint = inferProductBlueprint("Build an online banking app", "web_app");
    const gaps = productGaps(blueprint, { findings: [] }, { architectureSignals: { hasTests: false, hasDocs: false, hasDatabase: false, hasApi: false, hasDeployment: false }, dependencies: [], files: [], fileCount: 0, framework: "Unknown", manifests: [] });
    const score = productScore(blueprint, gaps);
    expect(gaps.some(gap => gap.area === "testing")).toBe(true);
    expect(score.dimensions).toHaveLength(10);
    expect(score.basis).toMatch(/derived from detected/i);
  });
  it("routes engineering objectives to specialists and an appropriate verification level", () => {
    const brief = engineeringBrief("Make the authentication system production-ready and faster");
    expect(brief.agents).toEqual(expect.arrayContaining(["architect", "security", "performance", "qa"]));
    expect(brief.verification).toBe("deep");
    expect(brief.impactAreas).toEqual(expect.arrayContaining(["workspace", "tests"]));
  });
  it("keeps risky maintenance operations approval-gated and health evidence-based", () => {
    const plan = maintenancePlan("Deploy to production and rotate credentials");
    expect(plan.safeMode).toBe(true);
    expect(plan.checkpointRequired).toBe(true);
    expect(plan.riskyActions).toContain("credential changes");
    const health = engineeringHealth({ architectureSignals: { hasTests: false, hasDocs: false, hasDatabase: false, hasApi: false, hasDeployment: false }, dependencies: [], files: [], fileCount: 0, framework: "Unknown", manifests: [] }, []);
    expect(health.evidenceBased).toBe(true);
    expect(health.dimensions).toHaveLength(8);
    expect(health.total).toBeLessThan(100);
  });
  it("infers creation modes, composes broad capabilities, and preserves the visual build loop", () => {
    expect(inferCreationMode("Take over this GitHub project and make it production-ready")).toBe("import");
    expect(matchCapabilities("Build a music streaming platform with analytics")).toEqual(expect.arrayContaining(["media", "data"]));
    const plan = buildCreationPlan("Create a website from this screenshot", [{ kind: "screenshot", name: "reference.png", source: "upload://reference.png", permissionConfirmed: true }]);
    expect(plan.mode).toBe("design");
    expect(plan.loop).toContain("render again");
    expect(plan.inputs[0].accepted).toBe(true);
  });
  it("previews sensitive intent and an actionable workflow before task execution", () => {
    const plan = buildCreationPlan("Deploy this application to production and publish the release");
    expect(plan.mode).toBe("deploy");
    expect(plan.safety.approvalRequired).toBe(true);
    expect(plan.safety.protectedActions).toEqual(expect.arrayContaining(["production", "publish"]));
    expect(plan.phases).toContain("verify");
    expect(plan.agents.length).toBeGreaterThan(0);
  });
  it("explains only evidence-backed outcomes and exposes safe next actions", () => {
    const result = explainCreationResult(["Added protected routes"], ["build passed", "login flow verified"], ["deployment still requires approval"]);
    expect(result.summary).toMatch(/1 meaningful change/);
    expect(result.evidence).toContain("login flow verified");
    expect(result.nextActions).toContain("Review the remaining findings");
    expect(result).not.toHaveProperty("reasoning");
  });
});
