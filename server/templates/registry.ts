import type { Project } from "../../drizzle/schema";

export type TemplateKind = "website" | "web_app" | "api" | "backend" | "automation" | "dashboard" | "saas";
export type TemplateFile = { path: string; content: string };
export type ProjectTemplate = { kind: TemplateKind; name: string; runtime: string; buildCommand: string; testCommand: string; files: (project: Project, objective: string) => TemplateFile[] };

const packageJson = (name: string, scripts: Record<string, string>) => JSON.stringify({ name: name.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 40), private: true, version: "0.1.0", scripts }, null, 2) + "\n";
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] ?? character));
const escapeMarkdown = (value: string) => value.replace(/([\\`*_[\]{}()#+.!|>])/g, "\\$1");

const browserFiles = (project: Project, objective: string): TemplateFile[] => {
  const name = escapeHtml(project.name);
  const objectiveHtml = escapeHtml(objective);
  const markdownName = escapeMarkdown(project.name);
  const markdownObjective = escapeMarkdown(objective);
  return [
    { path: "package.json", content: packageJson(project.name, { build: "node scripts/build.mjs", test: "node scripts/test.mjs", start: "node scripts/serve.mjs" }) },
    { path: "index.html", content: `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${name}</title><link rel="stylesheet" href="src/styles.css"></head><body><main class="shell"><p class="eyebrow">VOH GENERATED WORKSPACE</p><h1>${name}</h1><p>${objectiveHtml}</p><button id="action">Open the workspace</button><p id="status" aria-live="polite"></p></main><script type="module" src="src/main.js"></script></body></html>\n` },
    { path: "src/main.js", content: `const button = document.querySelector('#action');\nconst status = document.querySelector('#status');\nbutton?.addEventListener('click', () => { status.textContent = 'Workspace is ready for the next objective.'; });\n` },
    { path: "src/styles.css", content: `:root { color-scheme: dark; font-family: system-ui, sans-serif; background: #071016; color: #e4eeec; }\nbody { margin: 0; min-height: 100vh; display: grid; place-items: center; }\n.shell { width: min(680px, calc(100% - 40px)); padding: 48px; border: 1px solid #25423f; border-radius: 20px; background: #0b1a20; }\n.eyebrow { color: #7df2c5; letter-spacing: .16em; font-size: 11px; }\nbutton { border: 0; border-radius: 8px; padding: 12px 16px; background: #7df2c5; color: #071016; font-weight: 700; }\n` },
    { path: "scripts/build.mjs", content: `import fs from 'node:fs';\nfor (const file of ['index.html', 'src/main.js', 'src/styles.css']) fs.accessSync(file, fs.constants.R_OK);\nfs.mkdirSync('dist', { recursive: true });\nfs.cpSync('index.html', 'dist/index.html');\nconsole.log('Build verified: static browser files copied to dist/.');\n` },
    { path: "scripts/test.mjs", content: `import fs from 'node:fs';\nconst html = fs.readFileSync('index.html', 'utf8');\nif (!html.includes('<main') || !html.includes('src/main.js')) throw new Error('Generated website smoke test failed');\nconsole.log('Smoke test passed: document shell and entrypoint are present.');\n` },
    { path: "scripts/serve.mjs", content: `import { createServer } from 'node:http'; import { readFileSync } from 'node:fs';\ncreateServer((req, res) => { const file = req.url === '/' ? 'index.html' : req.url?.replace(/^\\//, ''); if (!file || file.includes('..')) { res.writeHead(400); return res.end('Bad path'); } try { res.end(readFileSync(file)); } catch { res.writeHead(404); res.end('Not found'); } }).listen(4173, () => console.log('Preview listening on 4173'));\n` },
    { path: "VOH.md", content: `# ${markdownName}\n\nGenerated from the ${project.projectType} template.\n\nObjective: ${markdownObjective}\n` },
  ];
};

const apiFiles = (project: Project, objective: string): TemplateFile[] => [
  { path: "package.json", content: packageJson(project.name, { build: "node scripts/check.mjs", test: "node scripts/check.mjs", start: "node src/server.mjs" }) },
  { path: "src/server.mjs", content: `import { createServer } from 'node:http';\nconst service = ${JSON.stringify(project.name)};\nconst objective = ${JSON.stringify(objective)};\ncreateServer((req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ service, objective, status: 'ok' })); }).listen(4173, () => console.log('API listening on 4173'));\n` },
  { path: "scripts/check.mjs", content: `import fs from 'node:fs'; fs.accessSync('src/server.mjs', fs.constants.R_OK); console.log('API source check passed.');\n` },
  { path: "VOH.md", content: `# ${escapeMarkdown(project.name)}\n\nGenerated API service.\n\nObjective: ${escapeMarkdown(objective)}\n` },
];

const templates: ProjectTemplate[] = [
  { kind: "website", name: "Static website", runtime: "Node 22", buildCommand: "pnpm build", testCommand: "pnpm test", files: browserFiles },
  { kind: "web_app", name: "Browser application", runtime: "Node 22", buildCommand: "pnpm build", testCommand: "pnpm test", files: browserFiles },
  { kind: "dashboard", name: "Dashboard", runtime: "Node 22", buildCommand: "pnpm build", testCommand: "pnpm test", files: browserFiles },
  { kind: "saas", name: "SaaS application", runtime: "Node 22", buildCommand: "pnpm build", testCommand: "pnpm test", files: browserFiles },
  { kind: "api", name: "HTTP API", runtime: "Node 22", buildCommand: "pnpm build", testCommand: "pnpm test", files: apiFiles },
  { kind: "backend", name: "Backend service", runtime: "Node 22", buildCommand: "pnpm build", testCommand: "pnpm test", files: apiFiles },
  { kind: "automation", name: "Automation service", runtime: "Node 22", buildCommand: "pnpm build", testCommand: "pnpm test", files: apiFiles },
];

export function getTemplate(kind: string) { return templates.find(template => template.kind === kind); }
export function listTemplates() { return templates.map(({ kind, name, runtime, buildCommand, testCommand }) => ({ kind, name, runtime, buildCommand, testCommand })); }
