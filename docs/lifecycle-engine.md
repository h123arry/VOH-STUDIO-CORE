# VOH STUDIO full software lifecycle engine

VOH STUDIO now treats a project as a lifecycle rather than a one-shot generation:

> **Idea → Plan → Build → Test → Version → Collaborate → Deploy → Monitor → Improve → Repeat**

## Real executors

- **Git:** repository initialization, status, history, diffs, branches, switching, merge, restore, revert, tags, fetch, pull, push, clone, commit, secret-path/content scanning, and repository-local commit identity fallback.
- **Repository intelligence:** framework/manifests/dependency/architecture mapping plus actionable heuristic review findings for security, reliability, testing, and secret hygiene.
- **Issues:** durable bugs, features, improvements, technical debt, and tasks; issues can become real autonomous VOH tasks.
- **Releases:** durable version records plus release-note drafts generated from actual Git history and diff statistics.
- **Deployment:** provider-agnostic adapters for static, frontend, server, container, and cloud targets; explicit development/preview/staging/production environment boundaries; preflight runs build, test, security, environment, configuration, dependency, and deployment checks.
- **Health:** actionable category scores for code, security, performance, tests, dependencies, architecture, documentation, and deployment.
- **Timeline:** project-scoped task events provide an auditable evolution history.
- **Recovery:** snapshots, task cancellation/pause/resume, Git restoration/revert, preflight blocking, and failure evidence prevent silent loss.

## GitHub boundary

The GitHub connector is present in the host catalog but disabled in this session. VOH therefore exposes a secure adapter state and refuses to claim that GitHub repositories, pull requests, issues, or remote pushes were performed. Local Git remains fully operational. When the connector is enabled, the adapter boundary is the place to route repository, PR, review, and issue operations without placing tokens in model context or task text.

## Deployment boundary

The deployment layer is deliberately provider-agnostic. It records plans and preflight evidence, and blocks external execution where a provider executor or approval path is not available. It never reports a deployment as successful merely because a plan was created.

## Operator APIs

Lifecycle procedures are under `lifecycle.git`, `lifecycle.github`, `lifecycle.repository`, `lifecycle.deployment`, `lifecycle.issues`, `lifecycle.releases`, `lifecycle.deployments`, and `lifecycle.timeline`. All procedures are authenticated and owner-scoped.
