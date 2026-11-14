# VOH STUDIO

**The Universal AI Software Development Studio. Powered by VOH.**

VOH STUDIO is a persistent AI development workspace for planning, creating, inspecting, testing, and extending real software projects. It builds on the existing React, Express, tRPC, Drizzle, and workspace architecture.

## What is available in the current build

- Prompt-driven project creation and iterative Build More workflows.
- Inline source editing with snapshot-backed saves and unsaved-change protection.
- Executable browser website, web app, and 2D game starters with build and smoke-test scripts.
- An installable mobile web app (PWA) starter with a web manifest, icon, build output, and tests. This is not native Android/iOS packaging.
- Public HTTPS repository import from GitHub, GitLab, and Bitbucket into an empty project workspace.
- Repository mapping, source indexing, security review, Git history, local commits, and workspace recovery.
- Persistent task events, plans, verification records, project memory, and quality reports.
- Sandboxed project previews with restrictive network policy.

Private GitHub operations, arbitrary dependency installation, native mobile packaging, isolated backend runtimes, and live external deployment providers still require dedicated authenticated integrations or execution infrastructure. Registered provider capabilities are not presented as completed integrations.

## Run locally

Requirements: Node.js 22, pnpm 10.18, and a MySQL-compatible database.

1. Install dependencies: `pnpm install`.
2. Configure the platform environment values in your local environment. The application uses `MANUS_PROJECT_ID`, `MANUS_JWT_SECRET`, `MANUS_OAUTH_API_URL`, `MANUS_API_URL`, `MANUS_API_KEY`, and `DATABASE_URL` for platform identity, sessions, model access, and persistence. Obtain real values from the platform environment; never commit secrets.
3. Apply database migrations: `pnpm db:migrate`.
4. Start the development server: `pnpm dev` (default port 3000; honors `PORT`).

## Development checks

- `pnpm check` — TypeScript validation.
- `pnpm test` — automated tests.
- `pnpm build` — production client and server build.
- `pnpm start` — serve the production build.

GitHub Actions runs all three validation commands on pull requests and pushes to `main`.

## Operator guide

See [docs/operator-guide.md](docs/operator-guide.md) for execution modes, repository import, preview boundaries, recovery, and operational behavior.

## Platform integration

This project retains the platform's existing auth, storage, model, and runtime boundaries. `server/_core/publicConfig.ts` exposes only named public runtime values; private keys stay server-side. The platform serves managed `/manus-storage/` assets, so the application does not register a second storage proxy.

Platform configuration is readable and editable through `webdev.config`. Default settings are initial values, not enforced constraints.
