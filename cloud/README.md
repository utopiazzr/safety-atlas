# Safety Atlas · Cloud intake

Anonymous submission API and owner moderation desk for Safety Atlas. Runs on Sites Workers, D1 and private R2; the website stays on GitHub Pages.

Node 22.13+ (24 recommended): npm ci, npm test, npm run build, npm run validate.
Build outputs a bundled Worker in dist/server/index.js. The Sites packager includes drizzle/ SQL migrations.

Server secrets: INTAKE_SECRET, ALTCHA_KEY_SECRET, ADMIN_EMAIL.
Server settings: ALLOWED_ORIGINS, GITHUB_REPOSITORY, GITHUB_REPOSITORY_ID, OIDC_AUDIENCE.
Never commit secret values. GitHub automation uses short-lived OIDC.

/admin permits the configured owner using Sites authenticated identity headers. Deploy behind the Sites gateway only; other hosts must replace the identity adapter and strip caller-supplied identity headers.

Boundaries:
- One-time ALTCHA work proof and client/global quotas add abuse friction, not a guarantee of human identity or DDoS protection.
- 100 files, 512 MiB per file, 1 GiB per submission, 8 MiB chunks. Global reserved storage: 10 GiB. Daily submission quotas: 5 per client, 100 globally.
- Incomplete uploads expire after 24 hours; completed raw material after 30 days. GitHub scheduled cleanup removes bytes; approved summaries persist. Audit retention: 90 days.
- Files are private opaque bytes, never extracted, rendered or executed. Path filtering is not malware scanning or secret detection inside archives. Review downloads in isolation.
- Owner explicitly selects public title, summary, primary sources, evidence type, conditions and limitations. Only this curated record enters GitHub review. Original notes, files and receipt secrets are not exported.
- Export and keep the receipt private. Its credential grants access to one submission.

Public API: /api/config, /api/challenge, /api/submissions.
Receipt API: /api/submissions/:id, .../files/:file/parts/:part, .../complete, .../note.
Owner API: /api/admin/*. Automation API: /api/automation/* (GitHub OIDC restricted to repository ID and main-branch cloud-intake workflow).
