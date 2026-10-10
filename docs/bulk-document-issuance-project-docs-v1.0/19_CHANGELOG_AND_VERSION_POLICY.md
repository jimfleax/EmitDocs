# Changelog and Version Policy

## Documentation pack v1.0 — 10 October 2026

- Consolidated the product discovery and Round 1–9 answers.
- Preserved decision log files v0.3–v0.9 as immutable source snapshots.
- Split the project into product, market, brand, interview history, requirements, PDF, architecture, data/API, email, security, hosting, roadmap, tests, decision register, research and risk files.
- Added a market landscape, a detailed conversation archive/provenance crosswalk, an archive completeness manifest, and refreshed the current architecture file so it reflects the final Round 6 choices rather than older candidate options.
- Removed a duplicated workflow section in the product requirements file and verified the pack for unresolved extraction markers.
- Prepared an all-in-one master Markdown for convenient reading alongside the modular, authoritative files and unchanged historical snapshots.
- Rechecked selected official provider and platform documentation on 10 October 2026.
- Added current brand status: no final name/tagline/logo/domain has been selected. Candidate names and taglines are explicitly unapproved brainstorming.
- Kept email provider open and retained the downloads-first prototype decision.
- Recorded Nodemailer as a request to investigate, not as a quota increase mechanism.

## Future document-change protocol

For every future decision:
1. Record the user's explicit choice and date/round.
2. State if it supersedes a prior choice and why.
3. Update `14_DECISION_REGISTER.md`.
4. Update affected product, architecture, state, security, cost, testing and roadmap files.
5. Preserve older source logs untouched.
6. Create a new decision-log version rather than rewriting a historical snapshot.
7. Recheck time-sensitive factual claims and log URLs/date checked.
8. Label user decision, recommendation, assumption, technical fact and open question distinctly.
9. Don't convert a recommendation into a choice without user approval.

## Historical decision-log versions

- v0.3 — early decision log following initial concept exploration.
- v0.4 — analysis of Round 4 answers/infrastructure.
- v0.5 — Round 5 implementation defaults and constraints.
- v0.6 — Round 6 architecture choices and Hono/browser clarification.
- v0.7 — Round 7 states, API, retries, retention and security choices.
- v0.8 — Round 8 deployment, provider comparison, roadmap and acceptance detail.
- v0.9 — Round 9 strict expiry, downloads-first, daily cleanup sweep, OpenAPI, developer defaults and Nodemailer request.

All are preserved in `source-logs/`.
