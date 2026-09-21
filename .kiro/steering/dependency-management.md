---
inclusion: fileMatch
fileMatchPattern: "**/package.json,**/pnpm-lock.yaml,**/.npmrc"
---

# Dependency Management

## Source of truth
- This repository uses pnpm `10.12.1` from the root `package.json`.
- Backend and frontend own separate manifests and dependency graphs. Backend lock state is `app/backend/pnpm-lock.yaml`; keep each manifest synchronized with its owning lockfile.
- CI installs with `pnpm install --frozen-lockfile`. Never resolve a mismatch by deleting or hand-editing a lockfile.
- Do not duplicate package inventories in steering; the manifests are authoritative.

## Add or update decision
Before adding or materially updating a package, evaluate necessity versus in-house code, maintenance health, security/advisories, license, bundle/runtime size, adoption, and transitive dependency risk. Prefer maintained, typed, well-supported packages and exact versions where a deliberate security or compatibility policy requires them; do not claim all current ranges are pinned.

Install or update from the package’s owning directory, then review both the manifest and lockfile. Keep production dependencies separate from development-only tooling and document the reason for material or unusual additions.

## Security and compatibility
- Review release notes and migration guides before major updates. Update one risky dependency family at a time.
- Run the owning app’s advisory check and inspect the result; do not use automatic audit fixes as an unreviewed mutation.
- Reject packages with unresolved critical vulnerabilities, untrusted provenance, incompatible licensing, or disproportionate transitive cost unless the decision is explicitly documented.
- Resolve peer-dependency warnings deliberately and test the affected integration rather than suppressing them.
- Never commit unresolved lockfile conflicts or credentials.

## Validation
After dependency changes, run the manifest-specific lint, build, typecheck, and applicable test gates. Backend/frontend commands and blocking CI gates are defined by `testing-strategy.md`, the app manifests, and `.github/workflows/ci.yml`; do not use root-level commands that the root manifest does not provide.

For major or security-sensitive changes, also review critical user flows, generated Prisma/client artifacts where applicable, bundle/runtime impact, and deployment compatibility. Update relevant documentation and keep the dependency change isolated from unrelated feature work.
