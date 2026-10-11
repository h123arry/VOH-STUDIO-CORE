import { listProjectFiles } from "../domain/project-service";

type IndexedFile = { path: string; content: string; language: string | null; size: number; terms: string[] };
type ContextIndex = { createdAt: number; files: IndexedFile[]; architecture: string[]; dependencies: string[]; routes: string[]; symbols: string[] };
const cache = new Map<number, ContextIndex>();
const tokenise = (value: string) => [...new Set(value.toLowerCase().split(/[^a-z0-9_$-]+/).filter(token => token.length > 2))];
const extract = (files: IndexedFile[]) => {
  const architecture = files.filter(file => /readme|voh|architecture|schema|route/i.test(file.path)).flatMap(file => file.content.split("\n").filter(line => line.trim().length > 8).slice(0, 30));
  const dependencies = files.filter(file => file.path.endsWith("package.json") || file.path.includes("requirements")).flatMap(file => { try { const json = JSON.parse(file.content); return Object.keys({ ...(json.dependencies ?? {}), ...(json.devDependencies ?? {}) }); } catch { return []; } });
  const routes = files.flatMap(file => [...file.content.matchAll(/(?:route|path|href)\s*[:=(]\s*["'`]([^"'`]+)/gi)].map(match => match[1]).filter(Boolean));
  const symbols = files.flatMap(file => [...file.content.matchAll(/(?:export\s+)?(?:function|class|const|interface|type)\s+([A-Za-z_$][\w$]*)/g)].map(match => match[1]));
  return { architecture: [...new Set(architecture)].slice(0, 80), dependencies: [...new Set(dependencies)].slice(0, 160), routes: [...new Set(routes)].slice(0, 120), symbols: [...new Set(symbols)].slice(0, 240) };
};
export async function indexProjectContext(projectId: number, force = false) {
  const existing = cache.get(projectId); if (existing && !force && Date.now() - existing.createdAt < 30_000) return existing;
  const files = (await listProjectFiles(projectId)).map(file => ({ path: file.path, content: file.content ?? "", language: file.language, size: file.size, terms: tokenise(`${file.path} ${file.content ?? ""}`) }));
  const index = { createdAt: Date.now(), files, ...extract(files) }; cache.set(projectId, index); return index;
}
export async function retrieveProjectContext(projectId: number, query: string, limit = 12) {
  const index = await indexProjectContext(projectId); const terms = tokenise(query);
  const relevant = index.files.map(file => ({ file, score: terms.reduce((score, term) => score + (file.terms.includes(term) ? 2 : 0) + (file.path.toLowerCase().includes(term) ? 3 : 0), 0) })).sort((a, b) => b.score - a.score).filter(item => item.score > 0).slice(0, limit).map(item => ({ path: item.file.path, content: item.file.content.slice(0, 12_000), score: item.score }));
  return { relevant, architecture: index.architecture.slice(0, 20), dependencies: index.dependencies, routes: index.routes.slice(0, 40), symbols: index.symbols.slice(0, 80), cachedAt: index.createdAt };
}
export function clearProjectContext(projectId: number) { cache.delete(projectId); }
