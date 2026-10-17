import type { Project } from "../../drizzle/schema";

export type TemplateKind = "website" | "web_app" | "game" | "api" | "backend" | "automation" | "dashboard" | "saas";
export type TemplateFile = { path: string; content: string };
export type ProjectTemplate = { kind: TemplateKind; name: string; runtime: string; buildCommand: string; testCommand: string; files: (project: Project, objective: string) => TemplateFile[] };

const packageJson = (name: string, scripts: Record<string, string>, type?: "module") => JSON.stringify({ name: name.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 40), private: true, version: "0.1.0", ...(type ? { type } : {}), scripts }, null, 2) + "\n";
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
    { path: "scripts/build.mjs", content: `import fs from 'node:fs';\nfor (const file of ['index.html', 'src/main.js', 'src/styles.css']) fs.accessSync(file, fs.constants.R_OK);\nfs.mkdirSync('dist/src', { recursive: true });\nfs.cpSync('index.html', 'dist/index.html');\nfs.cpSync('src', 'dist/src', { recursive: true });\nconsole.log('Build verified: static browser files copied to dist/.');\n` },
    { path: "scripts/test.mjs", content: `import fs from 'node:fs';\nconst html = fs.readFileSync('index.html', 'utf8');\nif (!html.includes('<main') || !html.includes('src/main.js')) throw new Error('Generated website smoke test failed');\nconsole.log('Smoke test passed: document shell and entrypoint are present.');\n` },
    { path: "scripts/serve.mjs", content: `import { createServer } from 'node:http'; import { readFileSync } from 'node:fs';\ncreateServer((req, res) => { const file = req.url === '/' ? 'index.html' : req.url?.replace(/^\\//, ''); if (!file || file.includes('..')) { res.writeHead(400); return res.end('Bad path'); } try { res.end(readFileSync(file)); } catch { res.writeHead(404); res.end('Not found'); } }).listen(4173, () => console.log('Preview listening on 4173'));\n` },
    { path: "VOH.md", content: `# ${markdownName}\n\nGenerated from the ${project.projectType} template.\n\nObjective: ${markdownObjective}\n` },
  ];
};

const gameFiles = (project: Project, objective: string): TemplateFile[] => {
  const name = escapeHtml(project.name);
  const markdownName = escapeMarkdown(project.name);
  const markdownObjective = escapeMarkdown(objective);
  return [
    { path: "package.json", content: packageJson(project.name, { build: "node scripts/build.mjs", test: "node scripts/test.mjs", start: "node scripts/serve.mjs" }, "module") },
    { path: "index.html", content: `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#101820"><title>${name}</title><link rel="stylesheet" href="src/styles.css"></head><body><main class="game-shell"><header><div><p class="eyebrow">ARCADE / 01</p><h1>${name}</h1></div><p class="score" aria-live="polite">Sparks <span id="score">0</span> / 6</p></header><canvas id="game" width="800" height="450" aria-label="Collect all six sparks. Move with arrow keys or WASD."></canvas><footer><p id="message" aria-live="polite">Collect all six sparks. Move with arrow keys or WASD.</p><button id="restart" type="button">Restart</button></footer></main><script type="module" src="src/main.js"></script></body></html>\n` },
    { path: "src/game.js", content: `export const createGame = () => ({ player: { x: 400, y: 225 }, sparks: [{ x: 110, y: 90 }, { x: 690, y: 100 }, { x: 160, y: 350 }, { x: 650, y: 345 }, { x: 400, y: 70 }, { x: 400, y: 380 }], score: 0, status: 'playing' });
export function stepGame(game, input, delta) {
  if (game.status !== 'playing') return game;
  const magnitude = Math.hypot(input.x, input.y) || 1;
  const speed = 220 * Math.min(delta, 0.04);
  const player = { x: Math.max(20, Math.min(780, game.player.x + input.x / magnitude * speed)), y: Math.max(20, Math.min(430, game.player.y + input.y / magnitude * speed)) };
  const sparks = game.sparks.filter(spark => Math.hypot(spark.x - player.x, spark.y - player.y) > 25);
  const score = game.score + game.sparks.length - sparks.length;
  return { player, sparks, score, status: score === 6 ? 'won' : 'playing' };
}
` },
    { path: "src/main.js", content: `import { createGame, stepGame } from './game.js';
const canvas = document.querySelector('#game');
const context = canvas.getContext('2d');
const scoreLabel = document.querySelector('#score');
const message = document.querySelector('#message');
const keys = new Set();
let game = createGame();
let previous = 0;
const resize = () => { const ratio = window.devicePixelRatio || 1; const bounds = canvas.getBoundingClientRect(); canvas.width = Math.round(bounds.width * ratio); canvas.height = Math.round(bounds.height * ratio); context.setTransform(canvas.width / 800, 0, 0, canvas.height / 450, 0, 0); };
const input = () => ({ x: Number(keys.has('ArrowRight') || keys.has('d')) - Number(keys.has('ArrowLeft') || keys.has('a')), y: Number(keys.has('ArrowDown') || keys.has('s')) - Number(keys.has('ArrowUp') || keys.has('w')) });
window.addEventListener('keydown', event => { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault(); keys.add(event.key); });
window.addEventListener('keyup', event => keys.delete(event.key));
window.addEventListener('blur', () => keys.clear());
window.addEventListener('resize', resize);
document.querySelector('#restart').addEventListener('click', () => { game = createGame(); message.textContent = 'Collect all six sparks. Move with arrow keys or WASD.'; });
function frame(time) {
  game = stepGame(game, input(), previous ? (time - previous) / 1000 : 0);
  previous = time;
  context.clearRect(0, 0, 800, 450);
  context.fillStyle = '#101820'; context.fillRect(0, 0, 800, 450);
  context.strokeStyle = 'rgba(141, 176, 179, .12)'; context.lineWidth = 1;
  for (let x = 0; x <= 800; x += 40) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 450); context.stroke(); }
  for (let y = 0; y <= 450; y += 40) { context.beginPath(); context.moveTo(0, y); context.lineTo(800, y); context.stroke(); }
  const pulse = 1 + Math.sin(time / 180) * 0.16;
  for (const spark of game.sparks) { context.beginPath(); context.arc(spark.x, spark.y, 9 * pulse, 0, Math.PI * 2); context.fillStyle = '#f4bd50'; context.shadowColor = '#f4bd50'; context.shadowBlur = 18; context.fill(); }
  context.shadowBlur = 0;
  context.beginPath(); context.arc(game.player.x, game.player.y, 15, 0, Math.PI * 2); context.fillStyle = '#e5684f'; context.fill();
  scoreLabel.textContent = String(game.score);
  if (game.status === 'won') message.textContent = 'All sparks collected. Nice run.';
  requestAnimationFrame(frame);
}
resize(); requestAnimationFrame(frame);
` },
    { path: "src/styles.css", content: `:root { color-scheme: dark; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; background: #101820; color: #f2eee5; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; }
.game-shell { width: min(100%, 960px); }
header, footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.eyebrow { margin: 0 0 8px; color: #8db0b3; font-size: 11px; }
h1 { margin: 0 0 18px; font-size: clamp(20px, 4vw, 32px); }
.score { color: #f4bd50; white-space: nowrap; }
canvas { display: block; width: 100%; aspect-ratio: 16 / 9; border: 1px solid #42545a; background: #101820; }
footer { min-height: 60px; color: #c7d0cc; }
button { border: 1px solid #8db0b3; border-radius: 4px; padding: 9px 13px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
button:hover { background: #26383d; }
@media (max-width: 520px) { body { padding: 16px; } header { align-items: flex-start; } footer { align-items: flex-start; flex-direction: column; padding-top: 8px; } }
` },
    { path: "scripts/build.mjs", content: `import fs from 'node:fs';
for (const file of ['index.html', 'src/main.js', 'src/game.js', 'src/styles.css']) fs.accessSync(file, fs.constants.R_OK);
fs.mkdirSync('dist/src', { recursive: true });
for (const file of ['index.html', 'src/main.js', 'src/game.js', 'src/styles.css']) fs.copyFileSync(file, 'dist/' + file);
console.log('Browser game built to dist/.');
` },
    { path: "scripts/test.mjs", content: `import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/game.js';
const initial = createGame();
assert.equal(initial.status, 'playing');
assert.equal(initial.sparks.length, 6);
const moved = stepGame(initial, { x: 1, y: 0 }, 0.04);
assert.ok(moved.player.x > initial.player.x);
const collected = stepGame({ ...initial, player: { x: 110, y: 90 } }, { x: 0, y: 0 }, 0);
assert.equal(collected.score, 1);
assert.equal(collected.sparks.length, 5);
const won = stepGame({ ...collected, score: 5, sparks: [{ x: 110, y: 90 }] }, { x: 0, y: 0 }, 0);
assert.equal(won.status, 'won');
console.log('Game logic checks passed.');
` },
    { path: "scripts/serve.mjs", content: `import { createServer } from 'node:http'; import { readFileSync } from 'node:fs';
createServer((req, res) => { const file = req.url === '/' ? 'index.html' : req.url?.replace(/^\\//, ''); if (!file || file.includes('..')) { res.writeHead(400); return res.end('Bad path'); } try { res.end(readFileSync(file)); } catch { res.writeHead(404); res.end('Not found'); } }).listen(4173, () => console.log('Preview listening on 4173'));
` },
    { path: "VOH.md", content: `# ${markdownName}\n\nGenerated browser game workspace with a responsive canvas, animated collectibles, keyboard controls, and a tested game loop.\n\nObjective: ${markdownObjective}\n` },
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
  { kind: "game", name: "2D browser game", runtime: "Node 22", buildCommand: "pnpm build", testCommand: "pnpm test", files: gameFiles },
  { kind: "dashboard", name: "Dashboard", runtime: "Node 22", buildCommand: "pnpm build", testCommand: "pnpm test", files: browserFiles },
  { kind: "saas", name: "SaaS application", runtime: "Node 22", buildCommand: "pnpm build", testCommand: "pnpm test", files: browserFiles },
  { kind: "api", name: "HTTP API", runtime: "Node 22", buildCommand: "pnpm build", testCommand: "pnpm test", files: apiFiles },
  { kind: "backend", name: "Backend service", runtime: "Node 22", buildCommand: "pnpm build", testCommand: "pnpm test", files: apiFiles },
  { kind: "automation", name: "Automation service", runtime: "Node 22", buildCommand: "pnpm build", testCommand: "pnpm test", files: apiFiles },
];

export function getTemplate(kind: string) { return templates.find(template => template.kind === kind); }
export function listTemplates() { return templates.map(({ kind, name, runtime, buildCommand, testCommand }) => ({ kind, name, runtime, buildCommand, testCommand })); }
