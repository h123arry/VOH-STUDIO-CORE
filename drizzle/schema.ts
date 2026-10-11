import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 140 }).notNull(),
  description: text("description").notNull(),
  projectType: varchar("projectType", { length: 48 }).notNull().default("web_app"),
  lifecycle: mysqlEnum("lifecycle", ["active", "paused", "archived"]).notNull().default("active"),
  workspacePath: varchar("workspacePath", { length: 255 }).notNull(),
  activeTaskId: int("activeTaskId"),
  settings: text("settings"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const projectFiles = mysqlTable("project_files", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  path: varchar("path", { length: 255 }).notNull(),
  language: varchar("language", { length: 32 }),
  contentHash: varchar("contentHash", { length: 64 }).notNull(),
  size: int("size").notNull().default(0),
  content: text("content"),
  lastOperation: varchar("lastOperation", { length: 32 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  ownerId: int("ownerId").notNull(),
  objective: text("objective").notNull(),
  userRequest: text("userRequest").notNull(),
  priority: int("priority").notNull().default(50),
  progress: int("progress").notNull().default(0),
  activeAgent: varchar("activeAgent", { length: 64 }),
  status: mysqlEnum("status", ["queued", "planning", "running", "waiting", "paused", "testing", "debugging", "completed", "failed", "cancelled"]).notNull().default("queued"),
  currentPhase: mysqlEnum("currentPhase", ["plan", "build", "run", "test", "inspect", "debug", "patch", "rebuild", "retest", "complete", "failed"]).notNull().default("plan"),
  viewMode: mysqlEnum("viewMode", ["simple", "developer"]).notNull().default("simple"),
  retryCount: int("retryCount").notNull().default(0),
  retryLimit: int("retryLimit").notNull().default(3),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  finalSummary: text("finalSummary"),
  failureClass: varchar("failureClass", { length: 48 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const taskSteps = mysqlTable("task_steps", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  orderIndex: int("orderIndex").notNull(),
  phase: varchar("phase", { length: 32 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  assignedAgent: varchar("assignedAgent", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed", "skipped"]).notNull().default("pending"),
  inputSummary: text("inputSummary"),
  outputSummary: text("outputSummary"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
});

export const agents = mysqlTable("agents", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  capabilityClass: varchar("capabilityClass", { length: 64 }).notNull(),
  executorStatus: mysqlEnum("executorStatus", ["active", "registered", "approval_required"]).notNull(),
  modelRole: varchar("modelRole", { length: 32 }),
  safetyScope: varchar("safetyScope", { length: 255 }).notNull(),
  description: text("description").notNull(),
});

export const agentRuns = mysqlTable("agent_runs", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  agentKey: varchar("agentKey", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["running", "completed", "failed", "blocked"]).notNull(),
  actionSummary: text("actionSummary").notNull(),
  modelRoute: varchar("modelRoute", { length: 140 }),
  modelMetadata: text("modelMetadata"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export const toolCalls = mysqlTable("tool_calls", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  agentKey: varchar("agentKey", { length: 64 }).notNull(),
  toolName: varchar("toolName", { length: 100 }).notNull(),
  arguments: text("arguments"),
  permissionScope: varchar("permissionScope", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["started", "completed", "failed", "blocked"]).notNull(),
  resultSummary: text("resultSummary"),
  exitCode: int("exitCode"),
  durationMs: int("durationMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const taskEvents = mysqlTable("task_events", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  actor: varchar("actor", { length: 64 }).notNull(),
  phase: varchar("phase", { length: 32 }).notNull(),
  summary: text("summary").notNull(),
  metadata: text("metadata"),
  severity: mysqlEnum("severity", ["info", "success", "warning", "error"]).notNull().default("info"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const taskErrors = mysqlTable("task_errors", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  source: varchar("source", { length: 64 }).notNull(),
  failureClass: varchar("failureClass", { length: 48 }).notNull(),
  diagnostic: text("diagnostic").notNull(),
  retryable: int("retryable").notNull().default(0),
  resolution: text("resolution"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const verificationRuns = mysqlTable("verification_runs", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  kind: varchar("kind", { length: 32 }).notNull(),
  command: varchar("command", { length: 255 }),
  status: mysqlEnum("status", ["passed", "failed", "skipped", "blocked"]).notNull(),
  output: text("output"),
  artifact: varchar("artifact", { length: 255 }),
  durationMs: int("durationMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const taskArtifacts = mysqlTable("task_artifacts", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  projectId: int("projectId").notNull(),
  kind: varchar("kind", { length: 32 }).notNull(),
  path: varchar("path", { length: 255 }).notNull(),
  label: varchar("label", { length: 160 }).notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const projectSnapshots = mysqlTable("project_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  taskId: int("taskId"),
  reason: varchar("reason", { length: 160 }).notNull(),
  snapshotPath: varchar("snapshotPath", { length: 255 }).notNull(),
  fileCount: int("fileCount").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const qualityScores = mysqlTable("quality_scores", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  projectId: int("projectId").notNull(),
  functionality: int("functionality").notNull(),
  design: int("design").notNull(),
  performance: int("performance").notNull(),
  security: int("security").notNull(),
  reliability: int("reliability").notNull(),
  accessibility: int("accessibility").notNull(),
  testCoverage: int("testCoverage").notNull(),
  codeQuality: int("codeQuality").notNull(),
  responsiveness: int("responsiveness").notNull(),
  total: int("total").notNull(),
  threshold: int("threshold").notNull().default(75),
  recommendations: text("recommendations"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const taskInstructions = mysqlTable("task_instructions", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  taskId: int("taskId").notNull(),
  ownerId: int("ownerId").notNull(),
  instruction: text("instruction").notNull(),
  status: mysqlEnum("status", ["queued", "processing", "completed", "cancelled"]).notNull().default("queued"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  processedAt: timestamp("processedAt"),
});

export const modelProviders = mysqlTable("model_providers", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["available", "unavailable", "configured"]).notNull(),
  endpoint: varchar("endpoint", { length: 255 }),
});

export const modelRoutes = mysqlTable("model_routes", {
  id: int("id").autoincrement().primaryKey(),
  role: varchar("role", { length: 32 }).notNull().unique(),
  providerKey: varchar("providerKey", { length: 64 }).notNull(),
  modelId: varchar("modelId", { length: 140 }),
  fallbackPolicy: varchar("fallbackPolicy", { length: 255 }).notNull(),
});

export const projectIssues = mysqlTable("project_issues", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  ownerId: int("ownerId").notNull(),
  kind: mysqlEnum("kind", ["bug", "feature", "improvement", "technical_debt", "task"]).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  description: text("description").notNull(),
  status: mysqlEnum("status", ["open", "in_progress", "resolved", "closed"]).notNull().default("open"),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).notNull().default("medium"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const projectReleases = mysqlTable("project_releases", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  ownerId: int("ownerId").notNull(),
  version: varchar("version", { length: 64 }).notNull(),
  notes: text("notes").notNull(),
  commitSha: varchar("commitSha", { length: 64 }),
  testSummary: text("testSummary"),
  deploymentSummary: text("deploymentSummary"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const deploymentRuns = mysqlTable("deployment_runs", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  ownerId: int("ownerId").notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  environment: mysqlEnum("environment", ["development", "preview", "staging", "production"]).notNull(),
  branch: varchar("branch", { length: 160 }).notNull(),
  status: mysqlEnum("status", ["planned", "blocked", "running", "succeeded", "failed"]).notNull().default("planned"),
  preflight: text("preflight"),
  externalId: varchar("externalId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskEvent = typeof taskEvents.$inferSelect;
export type TaskStep = typeof taskSteps.$inferSelect;
