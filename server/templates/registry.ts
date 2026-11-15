import type { Project } from "../../drizzle/schema";

export type TemplateKind = "website" | "web_app" | "mobile" | "native_mobile" | "game" | "api" | "backend" | "automation" | "dashboard" | "saas";
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

const apiFiles = (project: Project, objective: string): TemplateFile[] => [
  { path: "package.json", content: packageJson(project.name, { build: "node scripts/check.mjs", test: "node scripts/check.mjs", start: "node src/server.mjs" }) },
  { path: "src/server.mjs", content: `import { createServer } from 'node:http';\nconst service = ${JSON.stringify(project.name)};\nconst objective = ${JSON.stringify(objective)};\ncreateServer((req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ service, objective, status: 'ok' })); }).listen(4173, () => console.log('API listening on 4173'));\n` },
  { path: "scripts/check.mjs", content: `import fs from 'node:fs'; fs.accessSync('src/server.mjs', fs.constants.R_OK); console.log('API source check passed.');\n` },
  { path: "VOH.md", content: `# ${escapeMarkdown(project.name)}\n\nGenerated API service.\n\nObjective: ${escapeMarkdown(objective)}\n` },
];

const templates: ProjectTemplate[] = [
  { kind: "website", name: "Responsive multi-page business website", runtime: "Node 22", buildCommand: "pnpm build", testCommand: "pnpm test", files: websiteFiles },
  { kind: "web_app", name: "Browser application", runtime: "Node 22", buildCommand: "pnpm build", testCommand: "pnpm test", files: browserFiles },
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
