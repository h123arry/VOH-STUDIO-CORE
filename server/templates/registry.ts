import type { Project } from "../../drizzle/schema";

export type TemplateKind = "website" | "web_app" | "mobile" | "native_mobile" | "game" | "ai_app" | "desktop" | "api" | "backend" | "automation" | "dashboard" | "saas";
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

const websiteFiles = (project: Project, objective: string): TemplateFile[] => {
  const name = escapeHtml(project.name);
  const description = escapeHtml(objective);
  const mdName = escapeMarkdown(project.name);
  const mdObjective = escapeMarkdown(objective);
  const nav = (active: string) => '<header class="site-header"><a class="brand" href="index.html">' + name + '</a><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button><nav id="site-nav" aria-label="Main navigation"><a href="index.html" ' + (active === "home" ? 'aria-current="page"' : "") + '>Home</a><a href="about.html" ' + (active === "about" ? 'aria-current="page"' : "") + '>About</a><a href="services.html" ' + (active === "services" ? 'aria-current="page"' : "") + '>Services</a><a class="nav-cta" href="contact.html" ' + (active === "contact" ? 'aria-current="page"' : "") + '>Contact</a></nav></header>';
  const page = (title: string, active: string, content: string) => '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="' + description.slice(0, 155) + '"><title>' + title + ' | ' + name + '</title><link rel="stylesheet" href="src/styles.css"><script type="module" src="src/main.js"></script></head><body>' + nav(active) + content + '<footer class="site-footer"><a class="brand" href="index.html">' + name + '</a><p>Built with care. <span id="year"></span></p><a href="contact.html">Start a conversation</a></footer></body></html>';
  const pages: Array<{ path: string; content: string }> = [
    { path: "index.html", content: page("Welcome", "home", '<main><section class="hero"><p class="eyebrow">WELCOME TO ' + name.toUpperCase() + '</p><h1>Make your next move <span>with confidence.</span></h1><p class="lead">' + description + '</p><div class="actions"><a class="button primary" href="services.html">Explore what we do</a><a class="button secondary" href="about.html">Meet the team</a></div><p class="hero-note">Thoughtful service. Clear outcomes.</p></section><section class="section intro"><p class="eyebrow">A BETTER WAY FORWARD</p><h2>Good work starts with understanding.</h2><p>We bring practical thinking, dependable delivery and a personal approach to every project.</p></section><section class="feature-grid"><article><span>01</span><h3>Clarity first</h3><p>Know what matters, what happens next and how success is measured.</p></article><article><span>02</span><h3>Made around you</h3><p>A considered approach shaped around your goals and real-world needs.</p></article><article><span>03</span><h3>Built to last</h3><p>Useful solutions, careful execution and support beyond launch.</p></article></section><section class="closing"><h2>Let us make something meaningful.</h2><a class="button primary" href="contact.html">Get in touch</a></section></main>') },
    { path: "about.html", content: page("About us", "about", '<main><section class="page-hero"><p class="eyebrow">ABOUT ' + name.toUpperCase() + '</p><h1>People, purpose and a better standard of work.</h1><p class="lead">' + description + '</p></section><section class="section two-column"><div><p class="eyebrow">OUR APPROACH</p><h2>Understand first. Build with intention.</h2></div><div><p>We believe the best outcomes come from listening carefully, setting clear expectations and doing the important details well.</p><p>Every engagement is an opportunity to create something genuinely useful, with communication and quality at the centre.</p><a href="services.html">See how we can help</a></div></section></main>') },
    { path: "services.html", content: page("Services", "services", '<main><section class="page-hero"><p class="eyebrow">WHAT WE DO</p><h1>Practical services. Thoughtful delivery.</h1><p class="lead">A flexible starting point for the work that moves your business forward.</p></section><section class="service-grid"><article><span>01 / STRATEGY</span><h2>Plan with clarity</h2><p>Turn an ambition into clear priorities and a realistic path forward.</p></article><article><span>02 / DELIVERY</span><h2>Make it happen</h2><p>Move from idea to implementation with focused execution.</p></article><article><span>03 / SUPPORT</span><h2>Keep improving</h2><p>Refine what works and keep quality moving forward.</p></article></section><section class="closing"><h2>Have a project in mind?</h2><a class="button primary" href="contact.html">Talk to us</a></section></main>') },
    { path: "contact.html", content: page("Contact", "contact", '<main><section class="page-hero"><p class="eyebrow">CONTACT</p><h1>Tell us a little about what you need.</h1><p class="lead">Share a few details and save an enquiry draft on this device.</p></section><section class="contact-layout"><div><h2>Start a conversation.</h2><p>This starter stores the draft locally in your browser. Connect a backend or email provider to receive submissions centrally.</p></div><form id="contact-form" class="contact-form"><label for="contact-name">Your name</label><input id="contact-name" name="name" autocomplete="name" required minlength="2"><label for="contact-email">Email address</label><input id="contact-email" name="email" type="email" autocomplete="email" required><label for="contact-message">How can we help?</label><textarea id="contact-message" name="message" rows="5" required minlength="10"></textarea><button class="button primary" type="submit">Save enquiry draft</button><p id="form-status" role="status" aria-live="polite"></p></form></section></main>') },
  ];
  const css = ':root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#20202b;background:#faf9f7}*{box-sizing:border-box}body{margin:0}.site-header{height:76px;padding:0 max(24px,calc((100vw - 1120px)/2));display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e8e5e1}.brand{font-size:19px;font-weight:800;color:#242238;text-decoration:none}.site-header nav{display:flex;gap:28px}.site-header nav a{font-size:13px;color:#656372;text-decoration:none}.site-header nav a[aria-current=page]{color:#4d32a8;font-weight:700}.menu-toggle{display:none}.hero,.page-hero{max-width:1120px;margin:auto;padding:100px 24px}.hero{min-height:540px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;background:radial-gradient(ellipse at 80% 20%,#eee9fa,transparent 42%)}.eyebrow{font-size:10px;letter-spacing:.2em;font-weight:800;color:#7055b6}.hero h1,.page-hero h1{max-width:800px;font-size:clamp(40px,7vw,72px);line-height:1.05;letter-spacing:-.06em}.hero h1 span{display:block;color:#6b4bb2}.lead{max-width:680px;color:#686777;font-size:18px;line-height:1.8}.actions{display:flex;gap:12px;flex-wrap:wrap}.button{display:inline-flex;align-items:center;min-height:44px;padding:0 20px;border-radius:5px;font-size:13px;font-weight:700;text-decoration:none}.primary{background:#4d32a8;color:white}.secondary{border:1px solid #d7d2e1;color:#373346}.section,.feature-grid,.service-grid,.contact-layout{max-width:1120px;margin:auto;padding:64px 24px}.intro{max-width:780px;margin:0}.feature-grid,.service-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.feature-grid article,.service-grid article{padding:26px;border:1px solid #e8e5e1;background:white;border-radius:8px}.feature-grid p,.service-grid p,.two-column p,.contact-layout p{color:#74717d;line-height:1.8}.closing{padding:54px max(24px,calc((100vw - 1072px)/2));display:flex;align-items:center;justify-content:space-between;gap:20px;background:#f0edf7}.two-column,.contact-layout{display:grid;grid-template-columns:1fr 1fr;gap:60px}.contact-form{display:grid;gap:10px}.contact-form label{font-size:12px;font-weight:700}.contact-form input,.contact-form textarea{width:100%;padding:12px;border:1px solid #dcd8e2;border-radius:5px;background:white;font:inherit}.contact-form .button{justify-self:start;margin-top:10px}.site-footer{min-height:100px;padding:28px max(24px,calc((100vw - 1120px)/2));display:flex;align-items:center;justify-content:space-between;gap:18px;border-top:1px solid #e8e5e1}.site-footer p,.site-footer>a:last-child{font-size:12px;color:#777483}.page-hero{padding-top:76px;padding-bottom:48px}@media(max-width:700px){.site-header{height:66px}.menu-toggle{display:block;padding:8px 12px;background:transparent;border:1px solid #ddd7e9}.site-header nav{display:none;position:absolute;top:66px;left:0;right:0;padding:20px;background:#faf9f7;flex-direction:column}.site-header nav.is-open{display:flex}.hero{min-height:460px;padding-top:70px;padding-bottom:70px}.feature-grid,.service-grid,.two-column,.contact-layout{grid-template-columns:1fr;gap:18px}.section,.feature-grid,.service-grid,.contact-layout{padding-top:44px;padding-bottom:44px}.closing,.site-footer{align-items:flex-start;flex-direction:column}}';
  const js = 'const menuButton=document.querySelector(".menu-toggle");const navigation=document.querySelector("#site-nav");menuButton?.addEventListener("click",()=>{const expanded=menuButton.getAttribute("aria-expanded")==="true";menuButton.setAttribute("aria-expanded",String(!expanded));navigation?.classList.toggle("is-open",!expanded)});const year=document.querySelector("#year");if(year)year.textContent=String(new Date().getFullYear());const form=document.querySelector("#contact-form");form?.addEventListener("submit",event=>{event.preventDefault();if(!form.reportValidity())return;const values=Object.fromEntries(new FormData(form).entries());try{localStorage.setItem("voh-contact-enquiry",JSON.stringify({...values,savedAt:new Date().toISOString()}));const status=document.querySelector("#form-status");if(status)status.textContent="Your enquiry draft is saved on this device. Connect a backend to receive it centrally.";form.reset()}catch{const status=document.querySelector("#form-status");if(status)status.textContent="This browser could not save the draft. Copy your message before leaving."}});';
  return [
    { path: "package.json", content: packageJson(project.name, { build: "node scripts/build.mjs", test: "node scripts/test.mjs", start: "node scripts/serve.mjs" }, "module") },
    ...pages,
    { path: "src/styles.css", content: css },
    { path: "src/main.js", content: js },
    { path: "scripts/build.mjs", content: "import fs from 'node:fs';\nconst pages = ['index.html','about.html','services.html','contact.html'];\nfor (const file of [...pages,'src/main.js','src/styles.css']) fs.accessSync(file,fs.constants.R_OK);\nfs.mkdirSync('dist/src',{recursive:true});\nfor (const file of pages) fs.copyFileSync(file,'dist/'+file);\nfs.cpSync('src','dist/src',{recursive:true});\nconsole.log('Website build complete: four pages and shared assets copied to dist/.');\n" },
    { path: "scripts/test.mjs", content: "import assert from 'node:assert/strict';import fs from 'node:fs';const pages=['index.html','about.html','services.html','contact.html'];for(const page of pages){const html=fs.readFileSync(page,'utf8');assert.ok(html.includes('<main'),page+' has main landmark');assert.ok(html.includes('src/styles.css'));assert.ok(html.includes('src/main.js'));for(const target of pages)assert.ok(html.includes('href=\"'+target+'\"'),page+' links to '+target)}const contact=fs.readFileSync('contact.html','utf8');assert.ok(contact.includes('type=\"email\"')&&contact.includes('required'));const script=fs.readFileSync('src/main.js','utf8');assert.ok(script.includes('localStorage.setItem')&&script.includes('reportValidity'));console.log('Website checks passed: four linked pages, responsive assets, validated local enquiry draft.');\n" },
    { path: "scripts/serve.mjs", content: "import {createServer} from 'node:http';import {createReadStream,statSync} from 'node:fs';import path from 'node:path';const root=process.cwd();const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};createServer((req,res)=>{let pathname;try{pathname=decodeURIComponent(new URL(req.url||'/', 'http://localhost').pathname)}catch{res.writeHead(400);return res.end('Bad request')}const relative=pathname==='/'?'index.html':pathname.replace(/^\\\\/+/, '');const file=path.resolve(root,relative);if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(400);return res.end('Bad path')}try{if(!statSync(file).isFile())throw new Error('Not a file');res.setHeader('content-type',types[path.extname(file)]||'application/octet-stream');res.setHeader('x-content-type-options','nosniff');createReadStream(file).pipe(res)}catch{res.writeHead(404);res.end('Not found')}}).listen(4173,'127.0.0.1',()=>console.log('Local website server listening on http://127.0.0.1:4173'));\n" },
    { path: "VOH.md", content: "# " + mdName + "\n\nResponsive four-page website starter with shared navigation, mobile menu, about and services pages, and a locally saved contact enquiry draft.\n\nObjective: " + mdObjective + "\n\nThe contact form stores a draft in the visitor's browser only. Connect a backend or email provider to receive enquiries centrally.\n" },
  ];
};

const gameFiles = (project: Project, objective: string): TemplateFile[] => {
  const name = escapeHtml(project.name);
  const markdownName = escapeMarkdown(project.name);
  const markdownObjective = escapeMarkdown(objective);
  return [
    { path: "package.json", content: packageJson(project.name, { build: "node scripts/build.mjs", test: "node scripts/test.mjs", start: "node scripts/serve.mjs" }, "module") },
    { path: "index.html", content: `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#101820"><title>${name}</title><link rel="stylesheet" href="src/styles.css"></head><body><main class="game-shell"><header><div><p class="eyebrow">ARCADE / 01</p><h1>${name}</h1></div><p class="score" aria-live="polite">Sparks <span id="score">0</span> / 6 <small>Best <span id="best">0</span></small></p></header><canvas id="game" width="800" height="450" aria-label="Collect all six sparks. Move with arrow keys, WASD or touch controls."></canvas><footer><p id="message" aria-live="polite">Collect all six sparks. Move with arrows, WASD or touch controls.</p><div class="game-actions"><button id="pause" type="button">Pause</button><button id="restart" type="button">Restart</button></div></footer><div class="touch-controls" aria-label="Touch movement controls"><button type="button" data-key="ArrowUp" aria-label="Move up">↑</button><div><button type="button" data-key="ArrowLeft" aria-label="Move left">←</button><button type="button" data-key="ArrowDown" aria-label="Move down">↓</button><button type="button" data-key="ArrowRight" aria-label="Move right">→</button></div></div></main><script type="module" src="src/main.js"></script></body></html>\n` },
    { path: "src/game.js", content: `export const createGame = () => ({ player: { x: 400, y: 225 }, sparks: [{ x: 110, y: 90 }, { x: 690, y: 100 }, { x: 160, y: 350 }, { x: 650, y: 345 }, { x: 400, y: 70 }, { x: 400, y: 380 }], score: 0, status: 'playing' });
export const togglePause = game => game.status === 'playing' ? { ...game, status: 'paused' } : game.status === 'paused' ? { ...game, status: 'playing' } : game;
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
    { path: "src/main.js", content: `import { createGame, stepGame, togglePause } from './game.js';
const canvas = document.querySelector('#game');
const context = canvas.getContext('2d');
const scoreLabel = document.querySelector('#score');
const bestLabel = document.querySelector('#best');
const message = document.querySelector('#message');
const pauseButton = document.querySelector('#pause');
const keys = new Set();
let game = createGame();
let previous = 0;
let best = Number(localStorage.getItem('voh-game-best') || 0);
bestLabel.textContent = String(best);
const resize = () => { const ratio = window.devicePixelRatio || 1; const bounds = canvas.getBoundingClientRect(); canvas.width = Math.round(bounds.width * ratio); canvas.height = Math.round(bounds.height * ratio); context.setTransform(canvas.width / 800, 0, 0, canvas.height / 450, 0, 0); };
const input = () => ({ x: Number(keys.has('ArrowRight') || keys.has('d')) - Number(keys.has('ArrowLeft') || keys.has('a')), y: Number(keys.has('ArrowDown') || keys.has('s')) - Number(keys.has('ArrowUp') || keys.has('w')) });
const pause = () => { game = togglePause(game); keys.clear(); pauseButton.textContent = game.status === 'paused' ? 'Resume' : 'Pause'; message.textContent = game.status === 'paused' ? 'Paused. Take a breath.' : 'Back in the game. Collect all six sparks.'; };
window.addEventListener('keydown', event => { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault(); if (event.key.toLowerCase() === 'p' && !event.repeat) { pause(); return; } keys.add(event.key); });
window.addEventListener('keyup', event => keys.delete(event.key));
window.addEventListener('blur', () => keys.clear());
window.addEventListener('resize', resize);
document.querySelector('#pause').addEventListener('click', pause);
document.querySelector('#restart').addEventListener('click', () => { game = createGame(); keys.clear(); previous = 0; pauseButton.textContent = 'Pause'; message.textContent = 'Collect all six sparks. Move with arrows, WASD or touch controls.'; });
for (const control of document.querySelectorAll('[data-key]')) {
  const key = control.dataset.key;
  control.addEventListener('pointerdown', event => { event.preventDefault(); control.setPointerCapture(event.pointerId); keys.add(key); });
  const release = () => keys.delete(key);
  control.addEventListener('pointerup', release); control.addEventListener('pointercancel', release); control.addEventListener('lostpointercapture', release);
}
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
  if (game.score > best) { best = game.score; bestLabel.textContent = String(best); localStorage.setItem('voh-game-best', String(best)); }
  if (game.status === 'won') message.textContent = 'All sparks collected. Nice run.';
  if (game.status === 'paused') { context.fillStyle = 'rgba(8, 12, 18, .68)'; context.fillRect(0, 0, 800, 450); context.fillStyle = '#f2eee5'; context.font = 'bold 34px system-ui'; context.textAlign = 'center'; context.fillText('PAUSED', 400, 230); }
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
.game-actions { display: flex; gap: 8px; }
button { border: 1px solid #8db0b3; border-radius: 4px; padding: 9px 13px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
button:hover { background: #26383d; }
.score small { display: block; margin-top: 6px; color: #8db0b3; font-size: 10px; }
.touch-controls { display: none; justify-content: center; gap: 8px; margin-top: 12px; }
.touch-controls>div { display: flex; gap: 8px; }
.touch-controls button { width: 48px; height: 44px; font-size: 20px; touch-action: none; user-select: none; }
@media (max-width: 700px), (pointer: coarse) { .touch-controls { display: flex; } }
@media (max-width: 520px) { body { padding: 16px; } header { align-items: flex-start; } footer { align-items: flex-start; flex-direction: column; padding-top: 8px; } }
` },
    { path: "scripts/build.mjs", content: `import fs from 'node:fs';
for (const file of ['index.html', 'src/main.js', 'src/game.js', 'src/styles.css']) fs.accessSync(file, fs.constants.R_OK);
fs.mkdirSync('dist/src', { recursive: true });
for (const file of ['index.html', 'src/main.js', 'src/game.js', 'src/styles.css']) fs.copyFileSync(file, 'dist/' + file);
console.log('Browser game built to dist/.');
` },
    { path: "scripts/test.mjs", content: `import assert from 'node:assert/strict';
import { createGame, stepGame, togglePause } from '../src/game.js';
const initial = createGame();
assert.equal(initial.status, 'playing');
assert.equal(initial.sparks.length, 6);
const paused = togglePause(initial);
assert.equal(paused.status, 'paused');
assert.deepEqual(stepGame(paused, { x: 1, y: 0 }, 0.04), paused);
assert.equal(togglePause(paused).status, 'playing');
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

const mobileFiles = (project: Project, objective: string): TemplateFile[] => {
  const files = browserFiles(project, objective);
  return files.map(file => {
    if (file.path === "index.html") {
      return { ...file, content: file.content.replace("<title>", '<meta name="theme-color" content="#10101b"><link rel="manifest" href="manifest.webmanifest"><title>') };
    }
    if (file.path === "scripts/build.mjs") {
      return { ...file, content: file.content.replace("fs.cpSync('src', 'dist/src', { recursive: true });", "fs.cpSync('src', 'dist/src', { recursive: true });\nfs.copyFileSync('manifest.webmanifest', 'dist/manifest.webmanifest');\nfs.mkdirSync('dist/icons', { recursive: true });\nfs.copyFileSync('icons/app.svg', 'dist/icons/app.svg');") };
    }
    if (file.path === "scripts/test.mjs") {
      return { ...file, content: "import fs from 'node:fs';\nconst html = fs.readFileSync('index.html', 'utf8');\nconst manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));\nif (!html.includes('rel=\"manifest\"') || manifest.display !== 'standalone' || !fs.existsSync('icons/app.svg')) throw new Error('Mobile PWA smoke test failed');\nconsole.log('Mobile PWA smoke test passed.');\n" };
    }
    return file;
  }).concat([
    { path: "manifest.webmanifest", content: JSON.stringify({ name: project.name, short_name: project.name.slice(0, 12), description: objective.slice(0, 160), start_url: "./", scope: "./", display: "standalone", background_color: "#071016", theme_color: "#10101b", icons: [{ src: "icons/app.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }] }, null, 2) + "\n" },
    { path: "icons/app.svg", content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#10101b"/><path d="M128 128h256v64H192v64h160v64H192v64h192v64H128z" fill="#a78bfa"/></svg>\n' },
  ]);
};

const nativeMobileFiles = (project: Project, objective: string): TemplateFile[] => {
  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "voh-app";
  const bundle = "com.vohstudio." + slug.replace(/-/g, "");
  const app = `import { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
type Note = { id: string; text: string };
type Screen = "home" | "notes" | "profile";
const KEY = "voh-notes-v1";
export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => { AsyncStorage.getItem(KEY).then(value => { if (value) setNotes(JSON.parse(value)); }).finally(() => setReady(true)); }, []);
  const save = async (next: Note[]) => { setNotes(next); await AsyncStorage.setItem(KEY, JSON.stringify(next)); };
  const add = () => { const text = draft.trim(); if (!text) return; void save([{ id: String(Date.now()), text }, ...notes]); setDraft(""); };
  return <SafeAreaView style={styles.safe}>
    <StatusBar style="dark" />
    <View style={styles.header}><Text style={styles.brand}>{${JSON.stringify(project.name)}}</Text><Text style={styles.caption}>Powered by VOH</Text></View>
    <ScrollView contentContainerStyle={styles.content}>
      {screen === "home" && <View><Text style={styles.eyebrow}>YOUR SPACE</Text><Text style={styles.title}>A little more organised.</Text><Text style={styles.body}>{${JSON.stringify(objective)}}</Text><Text style={styles.count}>{notes.length} saved notes</Text><TouchableOpacity style={styles.primary} onPress={() => setScreen("notes")}><Text style={styles.primaryText}>Open my notes</Text></TouchableOpacity></View>}
      {screen === "notes" && <View><Text style={styles.eyebrow}>PERSONAL NOTES</Text><Text style={styles.title}>Keep the important things.</Text><TextInput value={draft} onChangeText={setDraft} placeholder="Write a note..." multiline style={styles.input}/><TouchableOpacity style={styles.primary} onPress={add}><Text style={styles.primaryText}>Save note</Text></TouchableOpacity>{ready && notes.map(note => <View key={note.id} style={styles.note}><Text style={styles.noteText}>{note.text}</Text><TouchableOpacity onPress={() => void save(notes.filter(item => item.id !== note.id))}><Text style={styles.delete}>Delete</Text></TouchableOpacity></View>)}</View>}
      {screen === "profile" && <View><Text style={styles.eyebrow}>PROFILE</Text><Text style={styles.title}>Your app, your space.</Text><Text style={styles.body}>Notes are stored locally on this device. Add authentication and a remote backend for accounts and cross-device sync.</Text></View>}
    </ScrollView>
    <View style={styles.tabs}>{(["home", "notes", "profile"] as Screen[]).map(item => <TouchableOpacity key={item} onPress={() => setScreen(item)} style={styles.tab}><Text style={screen === item ? styles.active : styles.tabText}>{item.toUpperCase()}</Text></TouchableOpacity>)}</View>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f7f6f3" }, header: { padding: 20, borderBottomWidth: 1, borderColor: "#e6e3dd", flexDirection: "row", justifyContent: "space-between" }, brand: { fontSize: 18, fontWeight: "800", color: "#242238" }, caption: { color: "#777483", fontSize: 11 }, content: { padding: 24, flexGrow: 1 }, eyebrow: { color: "#7055b6", fontWeight: "800", letterSpacing: 2, fontSize: 10 }, title: { color: "#242238", fontWeight: "800", fontSize: 32, marginVertical: 16 }, body: { color: "#686777", lineHeight: 24 }, count: { color: "#4d32a8", fontWeight: "800", fontSize: 22, marginVertical: 20 }, primary: { backgroundColor: "#4d32a8", padding: 15, borderRadius: 8, alignItems: "center", marginVertical: 12 }, primaryText: { color: "white", fontWeight: "700" }, input: { minHeight: 100, backgroundColor: "white", borderColor: "#dcd8e2", borderWidth: 1, borderRadius: 8, padding: 12, textAlignVertical: "top" }, note: { padding: 14, backgroundColor: "white", borderRadius: 8, marginTop: 10, flexDirection: "row", justifyContent: "space-between", gap: 12 }, noteText: { flex: 1, color: "#33313d" }, delete: { color: "#9c3d45", fontWeight: "700" }, tabs: { flexDirection: "row", borderTopWidth: 1, borderColor: "#e6e3dd", padding: 16, backgroundColor: "white" }, tab: { flex: 1, alignItems: "center" }, tabText: { color: "#8b8893", fontSize: 10, fontWeight: "700" }, active: { color: "#4d32a8", fontSize: 10, fontWeight: "800" }
});
`;
  const packageFile = JSON.stringify({
    name: slug + "-mobile", version: "1.0.0", private: true,
    scripts: { start: "expo start", android: "expo run:android", ios: "expo run:ios", web: "expo start --web", build: "expo export --platform android", test: "node scripts/verify-source.mjs", typecheck: "tsc --noEmit" },
    dependencies: { expo: "latest", react: "latest", "react-native": "latest", "expo-status-bar": "latest", "@react-native-async-storage/async-storage": "latest" },
    devDependencies: { typescript: "latest", "@types/react": "latest" }
  }, null, 2) + "\n";
  const config = JSON.stringify({ expo: { name: project.name, slug, version: "1.0.0", orientation: "portrait", userInterfaceStyle: "light", ios: { supportsTablet: true, bundleIdentifier: bundle }, android: { package: bundle }, plugins: ["@react-native-async-storage/async-storage"] } }, null, 2) + "\n";
  return [
    { path: "package.json", content: packageFile },
    { path: "app.json", content: config },
    { path: "tsconfig.json", content: JSON.stringify({ extends: "expo/tsconfig.base", compilerOptions: { strict: true } }, null, 2) + "\n" },
    { path: "App.tsx", content: app },
    { path: "scripts/verify-source.mjs", content: "import assert from 'node:assert/strict';import fs from 'node:fs';const app=fs.readFileSync('App.tsx','utf8');const config=JSON.parse(fs.readFileSync('app.json','utf8')).expo;const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));assert.ok(app.includes('AsyncStorage.setItem'));assert.ok(app.includes('AsyncStorage.getItem'));assert.ok(app.includes('type Screen'));assert.ok(app.includes('notes.filter'));assert.ok(config.android.package&&config.ios.bundleIdentifier);assert.ok(pkg.dependencies.expo&&pkg.dependencies['react-native']);console.log('Native mobile source checks passed. No APK or IPA is produced by this source validation.');\n" },
    { path: "README.md", content: "# " + project.name + "\n\nExpo + React Native native application source scaffold.\n\nObjective: " + objective + "\n\n## Setup\n\n1. Install Node.js and a package manager.\n2. Run pnpm install.\n3. Run npx expo install --fix to align React Native packages with the installed Expo SDK.\n4. Run pnpm start and open the project in Expo Go or a development build.\n5. Use pnpm android or pnpm ios with the matching native toolchain.\n\n## Build status\n\nThis workspace contains native React Native source and Android/iOS bundle identifiers. The configured build exports an Android JavaScript bundle; it does not create an installable APK. APK/IPA generation requires an EAS build configuration and credentials or a local Android/iOS toolchain. Local notes use AsyncStorage and stay on this device; authentication and remote sync are not configured.\n" },
  ];
};

const aiAppFiles = (project: Project, objective: string): TemplateFile[] => {
  const name = escapeHtml(project.name);
  const description = escapeHtml(objective);
  const packageFile = JSON.stringify({ name: project.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 40), private: true, version: "1.0.0", type: "module", scripts: { start: "node src/server.mjs", build: "node scripts/build.mjs", test: "node scripts/test.mjs" }, dependencies: {} }, null, 2) + "\n";
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="' + description.slice(0, 150) + '"><title>' + name + '</title><link rel="stylesheet" href="/styles.css"></head><body><main class="app"><header><p class="eyebrow">POWERED BY VOH</p><h1>' + name + '</h1><p>' + description + '</p></header><section class="chat" aria-label="AI conversation"><div id="messages" class="messages" aria-live="polite"><p class="welcome">Your AI workspace is ready. Ask a question to begin.</p></div><form id="chat-form"><label class="sr-only" for="prompt">Your message</label><textarea id="prompt" name="prompt" rows="3" maxlength="4000" placeholder="Ask your AI assistant..." required></textarea><div class="composer-footer"><span id="status" role="status">Your API key stays on the server.</span><button id="send" type="submit">Send message</button></div></form></section></main><script type="module" src="/main.js"></script></body></html>\n';
  const js = `const form=document.querySelector("#chat-form");const prompt=document.querySelector("#prompt");const messages=document.querySelector("#messages");const status=document.querySelector("#status");const send=document.querySelector("#send");const history=[];function addMessage(role,content){const article=document.createElement("article");article.className="message "+role;const label=document.createElement("strong");label.textContent=role==="user"?"You":"Assistant";const body=document.createElement("p");body.textContent=content;article.append(label,body);messages.append(article);messages.scrollTop=messages.scrollHeight;}form.addEventListener("submit",async event=>{event.preventDefault();const content=prompt.value.trim();if(!content)return;history.push({role:"user",content});addMessage("user",content);prompt.value="";send.disabled=true;status.textContent="Thinking…";try{const response=await fetch("/api/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({messages:history})});const result=await response.json();if(!response.ok)throw new Error(result.error||"The AI request failed.");history.push({role:"assistant",content:result.answer});addMessage("assistant",result.answer);status.textContent="Ready";}catch(error){history.pop();status.textContent=error instanceof Error?error.message:"Request failed";}finally{send.disabled=false;prompt.focus();}});`;
  const css = ':root{font-family:Inter,system-ui,sans-serif;color:#f3f3f5;background:#090a0e}*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:28px;display:grid;place-items:center}.app{width:min(820px,100%)}header{margin-bottom:28px}.eyebrow{font-size:10px;letter-spacing:.2em;color:#aaa;font-weight:800}h1{font-size:clamp(32px,6vw,52px);letter-spacing:-.05em;margin:12px 0}.app header>p:last-child{color:#a4a4ae;line-height:1.7}.chat{border:1px solid #303139;border-radius:14px;background:#111218;overflow:hidden}.messages{height:min(55vh,520px);min-height:260px;overflow:auto;padding:20px}.welcome{color:#92939d}.message{max-width:90%;margin:0 0 18px;padding:14px 16px;border-radius:10px;background:#1b1c24}.message.user{margin-left:auto;background:#282433}.message strong{font-size:11px;color:#c9c5d5}.message p{white-space:pre-wrap;line-height:1.6;margin:8px 0 0;color:#e6e6eb}form{border-top:1px solid #303139;padding:16px}textarea{width:100%;resize:vertical;min-height:78px;border:1px solid #383944;border-radius:8px;padding:12px;background:#0b0c11;color:#fff;font:inherit;outline:none}textarea:focus{border-color:#aaa}.composer-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:12px}#status{font-size:11px;color:#a4a4ae}button{border:0;border-radius:7px;padding:11px 18px;background:#eee;color:#111;font-weight:800;cursor:pointer}button:disabled{opacity:.45;cursor:wait}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(max-width:560px){body{padding:16px}.messages{height:50vh}.composer-footer{align-items:flex-start;flex-direction:column}button{width:100%}}';
  const server = `import process from "node:process";
try { process.loadEnvFile(); } catch (error) { if (error.code !== "ENOENT") throw error; }
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateMessages } from "./validation.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const built = path.join(root, "dist");
const publicRoot = existsSync(built) ? built : path.join(root, "public");
const baseValue = process.env.AI_API_BASE_URL || "https://api.openai.com/v1";
const base = new URL(baseValue);
if (base.protocol !== "https:" || base.username || base.password) throw new Error("AI_API_BASE_URL must be an HTTPS URL without embedded credentials.");
const apiKey = process.env.AI_API_KEY || "";
const model = process.env.AI_MODEL || "";
const limits = new Map();
function rateLimited(ip) {
  const now = Date.now(); const previous = limits.get(ip) || [];
  const recent = previous.filter(time => now - time < 60_000);
  if (recent.length >= 20) { limits.set(ip, recent); return true; }
  recent.push(now); limits.set(ip, recent);
  if (limits.size > 5000) for (const [key, times] of limits) if (!times.some(time => now - time < 60_000)) limits.delete(key);
  return false;
}
function send(res, status, data) { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }); res.end(JSON.stringify(data)); }
async function handleChat(req, res) {
  const ip = req.socket.remoteAddress || "unknown";
  if (rateLimited(ip)) return send(res, 429, { error: "Too many requests. Try again in a minute." });
  if (!apiKey || !model) return send(res, 503, { error: "AI_API_KEY and AI_MODEL must be configured on the server." });
  let raw = "";
  for await (const chunk of req) { raw += chunk.toString(); if (raw.length > 32_000) return send(res, 413, { error: "Request is too large." }); }
  let input;
  try { input = JSON.parse(raw); } catch { return send(res, 400, { error: "Invalid JSON request." }); }
  let messages;
  try { messages = validateMessages(input.messages); } catch (error) { return send(res, 400, { error: error.message }); }
  const endpoint = new URL("chat/completions", base.toString().replace(/\/?$/, "/"));
  let upstream;
  try { upstream = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + apiKey }, body: JSON.stringify({ model, messages, max_tokens: 900, stream: false }), signal: AbortSignal.timeout(30_000) }); }
  catch { return send(res, 502, { error: "The AI provider could not be reached." }); }
  if (!upstream.ok) return send(res, 502, { error: "The AI provider rejected the request. Check server configuration and provider account." });
  let payload;
  try { payload = await upstream.json(); } catch { return send(res, 502, { error: "The AI provider returned an invalid response." }); }
  const answer = payload?.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim()) return send(res, 502, { error: "The AI provider returned no assistant text." });
  return send(res, 200, { answer: answer.slice(0, 12_000) });
}
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
createServer(async (req, res) => {
  const pathname = new URL(req.url || "/", "http://localhost").pathname;
  if (req.method === "POST" && pathname === "/api/chat") return handleChat(req, res);
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "Method not allowed." });
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return send(res, 400, { error: "Invalid path." }); }
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const file = path.resolve(publicRoot, relative);
  if (file !== publicRoot && !file.startsWith(publicRoot + path.sep)) return send(res, 400, { error: "Invalid path." });
  try {
    if (!statSync(file).isFile()) throw new Error("Not a file");
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream", "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" });
    if (req.method === "HEAD") return res.end();
    createReadStream(file).pipe(res);
  } catch { res.writeHead(404); res.end("Not found"); }
}).listen(Number(process.env.PORT || 4173), "127.0.0.1", () => console.log("AI app listening on http://127.0.0.1:" + (process.env.PORT || 4173)));
`;
  const validation = "export function validateMessages(value) {\n  if (!Array.isArray(value) || value.length < 1 || value.length > 20) throw new Error('Send between 1 and 20 messages.');\n  return value.map(message => {\n    if (!message || !['user','assistant'].includes(message.role) || typeof message.content !== 'string') throw new Error('Messages must contain only user or assistant text.');\n    const content = message.content.trim();\n    if (!content || content.length > 4000) throw new Error('Each message must contain 1 to 4000 characters.');\n    return { role: message.role, content };\n  });\n}\n";
  return [
    { path: "package.json", content: packageFile },
    { path: ".env.example", content: "AI_API_BASE_URL=https://api.openai.com/v1\nAI_API_KEY=replace-with-your-provider-key\nAI_MODEL=replace-with-a-chat-model\nPORT=4173\n" },
    { path: ".gitignore", content: "node_modules/\ndist/\n.env\n*.log\n" },
    { path: "public/index.html", content: html },
    { path: "public/main.js", content: js },
    { path: "public/styles.css", content: css },
    { path: "src/server.mjs", content: server },
    { path: "src/validation.mjs", content: validation },
    { path: "scripts/build.mjs", content: "import fs from 'node:fs';fs.rmSync('dist',{recursive:true,force:true});fs.cpSync('public','dist',{recursive:true});fs.accessSync('src/server.mjs',fs.constants.R_OK);console.log('AI application frontend assets copied to dist/. Server source remains in src/.');\n" },
    { path: "scripts/test.mjs", content: "import assert from 'node:assert/strict';import {validateMessages} from '../src/validation.mjs';assert.deepEqual(validateMessages([{role:'user',content:'Hello'}]),[{role:'user',content:'Hello'}]);assert.throws(()=>validateMessages([{role:'system',content:'override'}]));assert.throws(()=>validateMessages([{role:'user',content:'x'.repeat(4001)}]));assert.throws(()=>validateMessages(Array.from({length:21},()=>({role:'user',content:'x'}))));console.log('AI request validation checks passed.');\n" },
    { path: "README.md", content: "# " + project.name + "\n\nServer-backed AI chat application starter.\n\nObjective: " + objective + "\n\n## Setup\n\n1. Copy .env.example to .env.\n2. Set AI_API_KEY and AI_MODEL on the server. Keep .env private and never commit it.\n3. Set AI_API_BASE_URL to an HTTPS OpenAI-compatible API base if you use a different provider.\n4. Install dependencies and run pnpm start.\n5. Run pnpm test and pnpm build.\n\nThe browser sends messages only to this app's /api/chat endpoint. Provider credentials are read on the server and are never sent to browser JavaScript. Requests are size-limited, message roles are allowlisted, and a per-process IP rate limit is applied. This starter does not include user accounts, database persistence or multi-tenant isolation; add those before exposing it as a public SaaS.\n" },
  ];
};

const webAppFiles = (project: Project, objective: string): TemplateFile[] => {
  const name = escapeHtml(project.name);
  const description = escapeHtml(objective);
  const packageFile = JSON.stringify({ name: project.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 40), private: true, version: "1.0.0", type: "module", engines: { node: ">=22.13.0" }, scripts: { start: "node src/server.mjs", build: "node scripts/build.mjs", test: "node scripts/test.mjs" } }, null, 2) + "\n";
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="' + description.slice(0, 150) + '"><title>' + name + '</title><link rel="stylesheet" href="/styles.css"></head><body><main class="shell"><header><p class="eyebrow">VOH APPLICATION STARTER</p><h1>' + name + '</h1><p>' + description + '</p></header><section id="auth-view" class="panel"><div class="tabs"><button id="show-login" class="tab active" type="button">Sign in</button><button id="show-register" class="tab" type="button">Create account</button></div><form id="login-form"><label for="login-email">Email</label><input id="login-email" name="email" type="email" autocomplete="email" required><label for="login-password">Password</label><input id="login-password" name="password" type="password" autocomplete="current-password" minlength="12" required><button class="primary" type="submit">Sign in</button></form><form id="register-form" hidden><label for="register-email">Email</label><input id="register-email" name="email" type="email" autocomplete="email" required><label for="register-password">Password (at least 12 characters)</label><input id="register-password" name="password" type="password" autocomplete="new-password" minlength="12" required><button class="primary" type="submit">Create account</button></form><p id="auth-status" role="status"></p></section><section id="app-view" hidden><div class="app-bar"><div><p class="eyebrow">YOUR WORKSPACE</p><h2>My tasks</h2></div><div><span id="user-email"></span><button id="logout" class="quiet" type="button">Sign out</button></div></div><form id="task-form" class="task-form"><label class="sr-only" for="task-title">New task</label><input id="task-title" name="title" maxlength="160" placeholder="Add a task..." required><button class="primary" type="submit">Add task</button></form><p id="task-status" role="status"></p><ul id="task-list" class="task-list"></ul></section></main><script type="module" src="/main.js"></script></body></html>\n';
  const css = ':root{font-family:Inter,system-ui,sans-serif;color:#f2f2f4;background:#0a0b10}*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:28px;display:grid;place-items:center}.shell{width:min(760px,100%)}header{margin-bottom:26px}.eyebrow{font-size:10px;letter-spacing:.18em;font-weight:800;color:#aaa}h1{font-size:clamp(32px,6vw,52px);letter-spacing:-.05em;margin:12px 0}header>p:last-child{color:#a2a3ac;line-height:1.7}.panel{padding:22px;border:1px solid #303139;border-radius:12px;background:#13141b}.tabs{display:flex;gap:8px;margin-bottom:22px}.tab,.quiet{border:1px solid #3a3b44;border-radius:6px;padding:9px 14px;background:transparent;color:#c8c8d0}.tab.active{background:#292633;color:#fff}form{display:grid;gap:10px}label{font-size:12px;color:#c7c7d0;font-weight:700}input{width:100%;padding:13px;border:1px solid #383944;border-radius:7px;background:#0c0d13;color:#fff;font:inherit;margin-bottom:8px}button{font:inherit;cursor:pointer}.primary{border:0;border-radius:7px;padding:12px 16px;background:#eee;color:#111;font-weight:800}.app-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 0}.app-bar h2{margin:6px 0;font-size:28px}.app-bar>div:last-child{display:flex;align-items:center;gap:12px;color:#aaa;font-size:12px}.task-form{display:grid;grid-template-columns:1fr auto;gap:10px;padding:18px;border:1px solid #303139;border-radius:10px;background:#13141b}.task-form input{margin:0}.task-list{list-style:none;margin:18px 0;padding:0;display:grid;gap:9px}.task{display:flex;align-items:center;gap:12px;padding:15px;border:1px solid #303139;border-radius:8px;background:#13141b}.task span{flex:1;overflow-wrap:anywhere}.task.done span{text-decoration:line-through;color:#777}.task input{width:18px;height:18px;margin:0}.delete{border:0;background:transparent;color:#d58c91;font-size:12px}#auth-status,#task-status{min-height:22px;color:#b8b8c4;font-size:12px}button:disabled{opacity:.5}@media(max-width:560px){body{padding:16px}.app-bar{align-items:flex-start;flex-direction:column}.task-form{grid-template-columns:1fr}.task-form button{width:100%}}';
  const js = `const authView=document.querySelector("#auth-view");const appView=document.querySelector("#app-view");const loginForm=document.querySelector("#login-form");const registerForm=document.querySelector("#register-form");const authStatus=document.querySelector("#auth-status");const taskStatus=document.querySelector("#task-status");const taskList=document.querySelector("#task-list");const taskForm=document.querySelector("#task-form");const taskTitle=document.querySelector("#task-title");const userEmail=document.querySelector("#user-email");let tasks=[];async function request(url,options={}){const response=await fetch(url,{...options,headers:{"content-type":"application/json",...(options.headers||{})}});const data=await response.json();if(!response.ok)throw new Error(data.error||"Request failed");return data;}function showAuth(){authView.hidden=false;appView.hidden=true;}function showApp(user){authView.hidden=true;appView.hidden=false;userEmail.textContent=user.email;void loadTasks();}async function loadTasks(){try{tasks=await request("/api/tasks");renderTasks();}catch(error){taskStatus.textContent=error.message;}}function renderTasks(){taskList.replaceChildren();for(const task of tasks){const row=document.createElement("li");row.className="task"+(task.done?" done":"");const checkbox=document.createElement("input");checkbox.type="checkbox";checkbox.checked=Boolean(task.done);checkbox.setAttribute("aria-label","Mark task complete");checkbox.addEventListener("change",async()=>{try{await request("/api/tasks/"+task.id,{method:"PATCH",body:JSON.stringify({done:checkbox.checked})});await loadTasks();}catch(error){taskStatus.textContent=error.message;}});const title=document.createElement("span");title.textContent=task.title;const remove=document.createElement("button");remove.className="delete";remove.textContent="Delete";remove.addEventListener("click",async()=>{try{await request("/api/tasks/"+task.id,{method:"DELETE"});await loadTasks();}catch(error){taskStatus.textContent=error.message;}});row.append(checkbox,title,remove);taskList.append(row);}}document.querySelector("#show-login").addEventListener("click",()=>{loginForm.hidden=false;registerForm.hidden=true;authStatus.textContent="";});document.querySelector("#show-register").addEventListener("click",()=>{loginForm.hidden=true;registerForm.hidden=false;authStatus.textContent="";});async function submitAuth(form,route){const values=Object.fromEntries(new FormData(form));try{const result=await request(route,{method:"POST",body:JSON.stringify(values)});form.reset();showApp(result.user);}catch(error){authStatus.textContent=error.message;}}loginForm.addEventListener("submit",event=>{event.preventDefault();void submitAuth(loginForm,"/api/login");});registerForm.addEventListener("submit",event=>{event.preventDefault();void submitAuth(registerForm,"/api/register");});taskForm.addEventListener("submit",async event=>{event.preventDefault();const title=taskTitle.value.trim();if(!title)return;try{await request("/api/tasks",{method:"POST",body:JSON.stringify({title})});taskForm.reset();taskStatus.textContent="Saved to the database.";await loadTasks();}catch(error){taskStatus.textContent=error.message;}});document.querySelector("#logout").addEventListener("click",async()=>{try{await request("/api/logout",{method:"POST",body:"{}"});}finally{showAuth();}});request("/api/me").then(result=>result.user?showApp(result.user):showAuth()).catch(showAuth);`;
  const db = `import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
export function openDatabase(filename) {
  if (filename !== ":memory:") mkdirSync(path.dirname(path.resolve(filename)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  db.exec("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at); CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 160), done INTEGER NOT NULL DEFAULT 0 CHECK(done IN (0,1)), created_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS tasks_owner_idx ON tasks(user_id, created_at DESC);");
  return db;
}
`;
  const auth = `import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
export function normalizeEmail(value) {
  if (typeof value !== "string") throw new Error("Enter a valid email address.");
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  return email;
}
export function hashPassword(password) {
  if (typeof password !== "string" || password.length < 12 || password.length > 128) throw new Error("Password must contain between 12 and 128 characters.");
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return salt.toString("hex") + ":" + hash.toString("hex");
}
export function verifyPassword(password, stored) {
  if (typeof password !== "string" || typeof stored !== "string") return false;
  const [saltHex, hashHex] = stored.split(":");
  if (!/^[a-f0-9]{32}$/.test(saltHex || "") || !/^[a-f0-9]{128}$/.test(hashHex || "")) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}
export const hashToken = token => createHash("sha256").update(token).digest("hex");
export function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map(part => part.trim().split(/=(.*)/s).slice(0, 2)).filter(pair => pair.length === 2));
}
`;
  const server = `import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { openDatabase } from "./db.mjs";
import { hashPassword, verifyPassword, normalizeEmail, hashToken, parseCookies } from "./auth.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const publicRoot = existsSync(dist) ? dist : path.join(root, "public");
const db = openDatabase(process.env.VOH_DB_PATH || path.join(root, "data", "voh.sqlite"));
const limits = new Map();
const sessionCookie = "voh_session";
const sessionDays = 7;
function limited(ip) {
  const now = Date.now(); const recent = (limits.get(ip) || []).filter(time => now - time < 900_000);
  if (recent.length >= 10) { limits.set(ip, recent); return true; }
  recent.push(now); limits.set(ip, recent);
  if (limits.size > 5000) for (const [key, times] of limits) if (!times.some(time => now - time < 900_000)) limits.delete(key);
  return false;
}
function send(res, status, value) { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }); res.end(JSON.stringify(value)); }
async function body(req) {
  let raw = "";
  for await (const chunk of req) { raw += chunk.toString(); if (raw.length > 16_000) throw new Error("Request body is too large."); }
  try { return JSON.parse(raw || "{}"); } catch { throw new Error("Invalid JSON request."); }
}
function sameOrigin(req) {
  if (req.headers["sec-fetch-site"] === "cross-site") return false;
  const origin = req.headers.origin;
  if (!origin) return false;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
function cookieOptions() { return sessionCookie + "=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" + (process.env.NODE_ENV === "production" ? "; Secure" : ""); }
function setSessionCookie(res, token) { res.setHeader("Set-Cookie", sessionCookie + "=" + token + "; HttpOnly; SameSite=Strict; Path=/; Max-Age=" + (sessionDays * 86400) + (process.env.NODE_ENV === "production" ? "; Secure" : "")); }
function currentUser(req) {
  const token = parseCookies(req.headers.cookie || "")[sessionCookie];
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const now = Date.now();
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
  return db.prepare("SELECT users.id, users.email, sessions.token_hash FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?").get(hashToken(token), now) || null;
}
function requireUser(req, res) { const user = currentUser(req); if (!user) { send(res, 401, { error: "Sign in to continue." }); return null; } return user; }
async function route(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname.startsWith("/api/") && req.method !== "GET" && !sameOrigin(req)) return send(res, 403, { error: "Cross-origin requests are not allowed." });
  if (req.method === "GET" && url.pathname === "/api/me") { const user = currentUser(req); return send(res, 200, { user: user ? { id: user.id, email: user.email } : null }); }
  if (req.method === "POST" && ["/api/login", "/api/register"].includes(url.pathname)) {
    const ip = req.socket.remoteAddress || "unknown";
    if (limited(ip)) return send(res, 429, { error: "Too many sign-in attempts. Try again later." });
    let input; try { input = await body(req); } catch (error) { return send(res, 400, { error: error.message }); }
    let email; try { email = normalizeEmail(input.email); } catch (error) { return send(res, 400, { error: error.message }); }
    let user;
    if (url.pathname === "/api/register") {
      let passwordHash; try { passwordHash = hashPassword(input.password); } catch (error) { return send(res, 400, { error: error.message }); }
      try { const inserted = db.prepare("INSERT INTO users(email,password_hash,created_at) VALUES(?,?,?)").run(email,passwordHash,Date.now()); user = { id: Number(inserted.lastInsertRowid), email }; }
      catch { return send(res, 409, { error: "An account with that email already exists." }); }
    } else {
      user = db.prepare("SELECT id,email,password_hash FROM users WHERE email = ?").get(email);
      if (!user || !verifyPassword(input.password, user.password_hash)) return send(res, 401, { error: "Email or password is incorrect." });
    }
    const token = randomBytes(32).toString("hex");
    db.prepare("INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)").run(hashToken(token),user.id,Date.now()+sessionDays*86400000,Date.now());
    setSessionCookie(res, token);
    return send(res, 200, { user: { id: user.id, email: user.email } });
  }
  if (req.method === "POST" && url.pathname === "/api/logout") {
    const user = currentUser(req);
    if (user) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(user.token_hash);
    res.setHeader("Set-Cookie", cookieOptions());
    return send(res, 200, { success: true });
  }
  if (url.pathname === "/api/tasks") {
    const user = requireUser(req,res); if (!user) return;
    if (req.method === "GET") return send(res, 200, db.prepare("SELECT id,title,done,created_at FROM tasks WHERE user_id = ? ORDER BY created_at DESC,id DESC").all(user.id));
    if (req.method === "POST") {
      let input; try { input = await body(req); } catch (error) { return send(res, 400, { error: error.message }); }
      const title = typeof input.title === "string" ? input.title.trim() : "";
      if (!title || title.length > 160) return send(res, 400, { error: "Task title must contain 1 to 160 characters." });
      const result = db.prepare("INSERT INTO tasks(user_id,title,created_at) VALUES(?,?,?)").run(user.id,title,Date.now());
      return send(res, 201, { id: Number(result.lastInsertRowid), title, done: 0 });
    }
  }
  const taskMatch = url.pathname.match(/^\\/api\\/tasks\\/(\\d+)$/);
  if (taskMatch) {
    const user = requireUser(req,res); if (!user) return;
    const id = Number(taskMatch[1]);
    if (req.method === "PATCH") {
      let input; try { input = await body(req); } catch (error) { return send(res, 400, { error: error.message }); }
      if (typeof input.done !== "boolean" && typeof input.title !== "string") return send(res, 400, { error: "Provide a task title or completion state." });
      if (typeof input.title === "string") { const title = input.title.trim(); if (!title || title.length > 160) return send(res, 400, { error: "Task title must contain 1 to 160 characters." }); db.prepare("UPDATE tasks SET title = ? WHERE id = ? AND user_id = ?").run(title,id,user.id); }
      if (typeof input.done === "boolean") db.prepare("UPDATE tasks SET done = ? WHERE id = ? AND user_id = ?").run(input.done ? 1 : 0,id,user.id);
      const updated = db.prepare("SELECT id,title,done,created_at FROM tasks WHERE id = ? AND user_id = ?").get(id,user.id);
      return updated ? send(res, 200, updated) : send(res, 404, { error: "Task not found." });
    }
    if (req.method === "DELETE") { const result = db.prepare("DELETE FROM tasks WHERE id = ? AND user_id = ?").run(id,user.id); return result.changes ? send(res, 200, { success: true }) : send(res, 404, { error: "Task not found." }); }
  }
  if (url.pathname.startsWith("/api/")) return send(res, 404, { error: "API route not found." });
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "Method not allowed." });
  let decoded; try { decoded = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end("Invalid path."); }
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\\/+/, "");
  const file = path.resolve(publicRoot, relative);
  if (file !== publicRoot && !file.startsWith(publicRoot + path.sep)) { res.writeHead(400); return res.end("Invalid path."); }
  const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
  try { if (!statSync(file).isFile()) throw new Error("Not a file"); res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream", "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'" }); if (req.method === "HEAD") return res.end(); createReadStream(file).pipe(res); }
  catch { res.writeHead(404); res.end("Not found."); }
}
createServer((req,res)=>{ route(req,res).catch(error=>{ console.error("Request failed:",error.message); if (!res.headersSent) send(res,500,{error:"An unexpected server error occurred."}); else res.destroy(); }); }).listen(Number(process.env.PORT || 4173),"127.0.0.1",()=>console.log("Authenticated web app listening on http://127.0.0.1:"+(process.env.PORT || 4173)));
`;
  const testScript = `import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { openDatabase } from "../src/db.mjs";
import { hashPassword, verifyPassword, normalizeEmail, hashToken, parseCookies } from "../src/auth.mjs";
const password = "correct horse battery";
const encoded = hashPassword(password);
assert.ok(verifyPassword(password, encoded));
assert.equal(verifyPassword("wrong password", encoded), false);
assert.throws(() => hashPassword("short"));
assert.equal(normalizeEmail("  USER@Example.COM "), "user@example.com");
assert.throws(() => normalizeEmail("not-an-email"));
assert.equal(parseCookies("a=1; voh_session=abc") .voh_session, "abc");
const db = openDatabase(":memory:");
const one = db.prepare("INSERT INTO users(email,password_hash,created_at) VALUES(?,?,?)").run("one@example.com",encoded,Date.now());
const two = db.prepare("INSERT INTO users(email,password_hash,created_at) VALUES(?,?,?)").run("two@example.com",encoded,Date.now());
db.prepare("INSERT INTO tasks(user_id,title,created_at) VALUES(?,?,?)").run(Number(one.lastInsertRowid),"Private task",Date.now());
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM tasks WHERE user_id = ?").get(Number(one.lastInsertRowid)).count,1);
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM tasks WHERE user_id = ?").get(Number(two.lastInsertRowid)).count,0);
assert.equal(hashToken("session").length,64);
db.close();
console.log("Authentication, SQLite persistence and per-user data-isolation checks passed.");
`;
  return [
    { path: "package.json", content: packageFile },
    { path: ".env.example", content: "PORT=4173\nVOH_DB_PATH=./data/voh.sqlite\nNODE_ENV=development\n" },
    { path: ".gitignore", content: "node_modules/\ndist/\ndata/\n.env\n*.log\n" },
    { path: "public/index.html", content: html },
    { path: "public/main.js", content: js },
    { path: "public/styles.css", content: css },
    { path: "src/db.mjs", content: db },
    { path: "src/auth.mjs", content: auth },
    { path: "src/server.mjs", content: server },
    { path: "scripts/build.mjs", content: "import fs from 'node:fs';fs.rmSync('dist',{recursive:true,force:true});fs.cpSync('public','dist',{recursive:true});fs.accessSync('src/server.mjs',fs.constants.R_OK);console.log('Web application frontend assets copied to dist/.');\n" },
    { path: "scripts/test.mjs", content: testScript },
    { path: "README.md", content: "# " + project.name + "\n\nAuthenticated full-stack web application starter using Node.js and SQLite.\n\nObjective: " + objective + "\n\n## Run\n\nRequires Node.js 22.13 or newer (node:sqlite). Copy .env.example to .env, run pnpm test, pnpm build, then pnpm start. The app creates its SQLite database in data/ and persists users, sessions and tasks across restarts.\n\n## Included\n\n- Email/password registration and login; passwords are scrypt-hashed with per-user salts.\n- HttpOnly, SameSite=Strict session cookies; only token hashes are stored in SQLite.\n- Per-IP sign-in rate limits and same-origin checks for state-changing API requests.\n- User-scoped task CRUD with SQL ownership conditions and persistent SQLite storage.\n\nThis is a single-instance starter, not a production multi-region identity system. Add email verification, password reset, operational backups, stronger edge rate limiting and deployment-specific review before public launch. HTTPS is required in production so Secure cookies are sent.\n" },
  ];
};

const desktopFiles = (project: Project, objective: string): TemplateFile[] => {
  const name = escapeHtml(project.name);
  const description = escapeHtml(objective);
  const packageFile = JSON.stringify({
    name: project.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 40),
    productName: project.name, version: "1.0.0", private: true, main: "src/main.cjs",
    scripts: { start: "electron .", build: "electron-builder --dir", test: "node scripts/test.cjs" },
    devDependencies: { electron: "latest", "electron-builder": "latest" },
    build: { appId: "com.vohstudio.desktopapp", productName: project.name, files: ["src/**/*", "public/**/*", "package.json"], directories: { output: "release" } }
  }, null, 2) + "\n";
  const main = `const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const dataFile = () => path.join(app.getPath("userData"), "notes.json");
async function readNotes() {
  try {
    const parsed = JSON.parse(await fs.readFile(dataFile(), "utf8"));
    return Array.isArray(parsed) ? parsed.filter(note => note && typeof note.id === "string" && typeof note.text === "string").slice(0, 100) : [];
  } catch (error) { if (error.code === "ENOENT") return []; throw error; }
}
ipcMain.handle("notes:load", async () => readNotes());
ipcMain.handle("notes:save", async (_event, input) => {
  if (!Array.isArray(input) || input.length > 100) throw new Error("Keep no more than 100 notes.");
  const notes = input.map(note => {
    if (!note || typeof note.id !== "string" || typeof note.text !== "string" || !note.text.trim() || note.text.length > 2000) throw new Error("Invalid note.");
    return { id: note.id.slice(0, 80), text: note.text.trim(), updatedAt: Date.now() };
  });
  const destination = dataFile();
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const temporary = destination + "." + randomUUID() + ".tmp";
  try {
    await fs.writeFile(temporary, JSON.stringify(notes), { flag: "wx", mode: 0o600 });
    await fs.rename(temporary, destination);
  } catch (error) { await fs.rm(temporary, { force: true }).catch(() => undefined); throw error; }
  return { saved: true, count: notes.length };
});
function createWindow() {
  const window = new BrowserWindow({
    width: 1120, height: 760, minWidth: 360, minHeight: 520,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  void window.loadFile(path.join(__dirname, "..", "public", "index.html"));
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
`;
  const preload = `const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("vohDesktop", {
  notes: {
    load: () => ipcRenderer.invoke("notes:load"),
    save: notes => ipcRenderer.invoke("notes:save", notes),
  },
});
`;
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\'; object-src \'none\'; base-uri \'none\';"><title>' + name + '</title><link rel="stylesheet" href="styles.css"></head><body><main><header><p class="eyebrow">VOH DESKTOP</p><h1>' + name + '</h1><p>' + description + '</p></header><section class="panel"><form id="note-form"><label for="note">New note</label><textarea id="note" maxlength="2000" required placeholder="Write something worth keeping..."></textarea><button type="submit">Save note</button></form><p id="status" role="status" aria-live="polite"></p><ul id="notes"></ul></section></main><script src="renderer.js"></script></body></html>';
  const renderer = `const form = document.querySelector("#note-form");
const input = document.querySelector("#note");
const list = document.querySelector("#notes");
const status = document.querySelector("#status");
let notes = [];
function render() {
  list.replaceChildren();
  for (const note of notes) {
    const row = document.createElement("li");
    const text = document.createElement("span");
    text.textContent = note.text;
    const remove = document.createElement("button");
    remove.textContent = "Delete";
    remove.addEventListener("click", async () => {
      notes = notes.filter(item => item.id !== note.id);
      await save();
    });
    row.append(text, remove);
    list.append(row);
  }
}
async function save() {
  try {
    const result = await window.vohDesktop.notes.save(notes);
    status.textContent = "Saved locally · " + result.count + " notes";
    render();
  } catch (error) { status.textContent = error.message || "Could not save notes."; }
}
form.addEventListener("submit", async event => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  notes.unshift({ id: crypto.randomUUID(), text });
  input.value = "";
  await save();
});
window.vohDesktop.notes.load().then(value => { notes = value; render(); status.textContent = "Your notes are stored in this desktop app's private data folder."; }).catch(error => { status.textContent = error.message; });
`;
  const css = ':root{font-family:Inter,system-ui,sans-serif;color:#f1f1f3;background:#0c0d12}*{box-sizing:border-box}body{margin:0;padding:32px}main{max-width:900px;margin:auto}header{margin-bottom:28px}.eyebrow{font-size:10px;letter-spacing:.2em;font-weight:800;color:#aaa}h1{font-size:clamp(34px,6vw,54px);letter-spacing:-.05em;margin:12px 0}header p:last-child{color:#a2a3ad;line-height:1.7}.panel{padding:22px;border:1px solid #303139;border-radius:12px;background:#14151c}form{display:grid;gap:12px}label{font-size:12px;font-weight:700;color:#c8c8d0}textarea{min-height:110px;padding:13px;border:1px solid #383944;border-radius:8px;background:#0b0c12;color:white;font:inherit;resize:vertical}button{padding:10px 15px;border:0;border-radius:7px;background:#eee;color:#111;font-weight:800;cursor:pointer}form button{justify-self:start}#status{min-height:22px;color:#aaa;font-size:12px}ul{list-style:none;padding:0;display:grid;gap:9px}li{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px;border:1px solid #303139;border-radius:8px;background:#1b1c24}li span{white-space:pre-wrap;overflow-wrap:anywhere}li button{background:transparent;color:#d99a9e}';
  return [
    { path: "package.json", content: packageFile },
    { path: ".gitignore", content: "node_modules/\nrelease/\ndist/\n*.log\n" },
    { path: "src/main.cjs", content: main },
    { path: "src/preload.cjs", content: preload },
    { path: "public/index.html", content: html },
    { path: "public/renderer.js", content: renderer },
    { path: "public/styles.css", content: css },
    { path: "scripts/test.cjs", content: "const fs=require('node:fs');const main=fs.readFileSync('src/main.cjs','utf8');const preload=fs.readFileSync('src/preload.cjs','utf8');const html=fs.readFileSync('public/index.html','utf8');if(!main.includes('contextIsolation: true')||!main.includes('sandbox: true')||!main.includes('nodeIntegration: false'))throw new Error('Electron renderer security configuration is incomplete');if(!preload.includes('contextBridge.exposeInMainWorld')||!preload.includes('ipcRenderer.invoke'))throw new Error('Preload bridge is missing');if(!html.includes('Content-Security-Policy'))throw new Error('Renderer CSP is missing');console.log('Desktop source and renderer isolation checks passed.');\n" },
    { path: "README.md", content: "# " + project.name + "\n\nElectron desktop application source starter.\n\nObjective: " + objective + "\n\nRun pnpm install, pnpm test, then pnpm start. Build a platform-specific unpacked app with pnpm build; distribution installers require platform-specific packaging and signing configuration.\n\nThe renderer runs with context isolation and Chromium sandbox enabled, Node integration disabled, and a narrow preload IPC bridge. Notes are stored locally in Electron's app data directory using atomic writes. This starter does not provide cloud sync or an installer signed for distribution.\n" },
  ];
};

const apiFiles = (project: Project, objective: string): TemplateFile[] => [
  { path: "package.json", content: packageJson(project.name, { build: "node scripts/check.mjs", test: "node scripts/check.mjs", start: "node src/server.mjs" }) },
  { path: "src/server.mjs", content: `import { createServer } from 'node:http';\nconst service = ${JSON.stringify(project.name)};\nconst objective = ${JSON.stringify(objective)};\ncreateServer((req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ service, objective, status: 'ok' })); }).listen(4173, () => console.log('API listening on 4173'));\n` },
  { path: "scripts/check.mjs", content: `import fs from 'node:fs'; fs.accessSync('src/server.mjs', fs.constants.R_OK); console.log('API source check passed.');\n` },
  { path: "VOH.md", content: `# ${escapeMarkdown(project.name)}\n\nGenerated API service.\n\nObjective: ${escapeMarkdown(objective)}\n` },
];

const templates: ProjectTemplate[] = [
  { kind: "website", name: "Responsive multi-page business website", runtime: "Node 22", buildCommand: "pnpm build", testCommand: "pnpm test", files: websiteFiles },
  { kind: "ai_app", name: "Server-backed AI chat application", runtime: "Node 22", buildCommand: "pnpm build", testCommand: "pnpm test", files: aiAppFiles },
  { kind: "web_app", name: "Authenticated SQLite web application", runtime: "Node 22.13+", buildCommand: "pnpm build", testCommand: "pnpm test", files: webAppFiles },
  { kind: "desktop", name: "Secure Electron desktop application source", runtime: "Electron / Node 22", buildCommand: "pnpm build", testCommand: "pnpm test", files: desktopFiles },
  { kind: "mobile", name: "Installable mobile web app (PWA)", runtime: "Modern mobile browser", buildCommand: "pnpm build", testCommand: "pnpm test", files: mobileFiles },
  { kind: "native_mobile", name: "Expo and React Native native app source", runtime: "Expo / React Native", buildCommand: "pnpm build", testCommand: "pnpm test", files: nativeMobileFiles },
  { kind: "game", name: "2D browser game", runtime: "Node 22", buildCommand: "pnpm build", testCommand: "pnpm test", files: gameFiles },
  { kind: "dashboard", name: "Dashboard", runtime: "Node 22", buildCommand: "pnpm build", testCommand: "pnpm test", files: browserFiles },
  { kind: "saas", name: "SaaS application", runtime: "Node 22", buildCommand: "pnpm build", testCommand: "pnpm test", files: browserFiles },
  { kind: "api", name: "HTTP API", runtime: "Node 22", buildCommand: "pnpm build", testCommand: "pnpm test", files: apiFiles },
  { kind: "backend", name: "Backend service", runtime: "Node 22", buildCommand: "pnpm build", testCommand: "pnpm test", files: apiFiles },
  { kind: "automation", name: "Automation service", runtime: "Node 22", buildCommand: "pnpm build", testCommand: "pnpm test", files: apiFiles },
];

export function getTemplate(kind: string) { return templates.find(template => template.kind === kind); }
export function listTemplates() { return templates.map(({ kind, name, runtime, buildCommand, testCommand }) => ({ kind, name, runtime, buildCommand, testCommand })); }
