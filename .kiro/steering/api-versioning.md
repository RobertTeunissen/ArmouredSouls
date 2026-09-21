---
inclusion: fileMatch
fileMatchPattern: "**/routes/**,**/api/**,**/*.route.ts,**/*.router.ts"
---

# API Versioning and Breaking Changes

## Current state
The API is currently unversioned. If versioning becomes necessary, use URL-based paths such as `/api/v1/` and `/api/v2/`. Maintain a deprecated version for at least six months unless an explicitly approved migration policy says otherwise. No versioned routes or deprecation middleware should be assumed to exist today.

## Change classification
Breaking changes include removing endpoints or fields, changing field names/types or HTTP methods, changing authentication or the error contract, and making optional input required. Adding endpoints, optional input, response fields, deprecation metadata, bug fixes, and performance improvements are normally non-breaking.

When uncertain, treat a change as breaking until clients, API documentation, and migration impact have been reviewed.

## Future version contract
When a breaking version is introduced:
1. Document the changed contract and a runnable migration path.
2. Keep version-specific route/controller adapters separate while reusing the same services and domain logic.
3. Run old and new versions during the support window; monitor deprecated usage.
4. Emit deprecation and sunset metadata only for an actually deployed deprecated endpoint.
5. Remove the old version only after the support window and return a documented removal response such as HTTP 410 using the standard `{ error, code, details? }` shape.

Do not copy illustrative response shapes, fake endpoints, headers, dates, or middleware into production without an implementation and route test.

## Compatibility rules
- Add rather than remove response fields; make additions optional where clients may not understand them.
- Expand accepted input rather than narrowing existing formats.
- Preserve authentication, status-code, and error-response semantics for existing clients.
- A migration guide must cover request/response changes, authentication changes, compatibility dates, and affected client actions.
- Keep version-specific API documentation and integration tests alongside a real versioned implementation; do not create version examples before the version exists.

## Breaking-change checklist
- [ ] Impact and migration path documented.
- [ ] New version and shared-service boundaries implemented and tested.
- [ ] Existing clients have a minimum six-month support/deprecation window.
- [ ] Deprecation usage is observable and communicated.
- [ ] API docs, guides, frontend callers, and error contracts are updated.
- [ ] Sunset/removal behavior is tested before the old version is deleted.
