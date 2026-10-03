# Repository instructions

## Data and deployment

- The public repository contains source code, public recruitment JSON and public-only database snapshots. Never commit personal workspace databases, sessions, recovery credentials, cookies, environment secrets, or the private Sites project identity.
- Keep stable job IDs and existing verification/coverage markers. Never infer missing application dates or claim complete coverage for a partial or blocked source.
- Preserve user progress when updating public data. Personal SQLite/D1 storage is independent of the public catalog.
- Preserve the configured Sites audience unless the owner explicitly requests a change. Keep personal records isolated from the public recruitment catalog.
- Follow `docs/self-hosting.md` and `docs/selfhost-verification.md`. Validate changes with the checks relevant to them; do not describe Node HTTP tests as Docker container tests.
