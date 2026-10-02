# Repository instructions

## Owner-directed automated work

The repository owner is the GitHub account `xcosmosbox` (user ID `56502269`). For work the owner asks an assistant or agent to perform:

- Make commits with the owner as both Git author and committer. For local Git use `xcosmosbox` and `56502269+xcosmosbox@users.noreply.github.com` for both identities. Run `node scripts/configure-owner-git.mjs` in this checkout before committing.
- Do not add assistant, Codex, GPT or OpenAI author identities, co-author trailers, or generated-by trailers to commit messages.
- Push through the owner's authorized GitHub connection. With a connector, verify that the returned commit's GitHub `author.login` and `committer.login` are both `xcosmosbox` before advancing a branch when the API allows a separate commit/ref flow. Verify initialized branches immediately after a contents-API write.
- Do not claim that local Git settings change GitHub authentication, application audit logs or the push actor. If the available connection cannot satisfy the requested identity, stop the write and explain the limitation.
- Preserve genuine third-party contributions and their attribution. These rules apply to automated work on behalf of this owner, not to unrelated contributors.

## Data and deployment

- The public repository contains source code, public recruitment JSON and public-only database snapshots. Never commit personal workspace databases, sessions, recovery credentials, cookies, environment secrets, or the private Sites project identity.
- Keep stable job IDs and existing verification/coverage markers. Never infer missing application dates or claim complete coverage for a partial or blocked source.
- Preserve user progress when updating public data. Personal SQLite/D1 storage is independent of the public catalog.
- Keep the existing Sites deployment private unless the owner explicitly changes its audience. Publishing this GitHub repository does not authorize public Sites access.
- Follow `docs/self-hosting.md` and `docs/selfhost-verification.md`. Validate changes with the checks relevant to them; do not describe Node HTTP tests as Docker container tests.
