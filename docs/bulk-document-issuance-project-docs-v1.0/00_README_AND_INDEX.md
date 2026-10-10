# Bulk Document Issuance — Project Documentation Pack

**Pack version:** 1.0  
**Assembled:** 10 October 2026  
**Primary specification snapshot:** decision log v0.9  
**Status:** Discovery record consolidated; implementation remains subject to proof-of-concept validation.

## Purpose

This directory is the central project archive for the document-automation web app discussed in the conversation. It is intended as the base for later PRDs, engineering implementation, marketing/promotion, presentations, brand exploration and future ideation. It separates explicit user choices from recommendations, assumptions, dated research facts and open issues.

The source decision logs v0.3–v0.9 are preserved in `source-logs/` without edits. The full v0.9 log is also available as `SOURCE_V0.9_FULL.md`. The interview archive records the exact initial user brief and exact Round 1–9 response values; the conversation archive/provenance file maps assistant analysis to the topical specifications. This is a comprehensive project-relevant record, not a raw byte-for-byte export of the ChatGPT UI or hidden tool payloads. Older logs are historical snapshots: they may contain questions that were still open at that time. Use `14_DECISION_REGISTER.md` for current status.

## Documentation map

- `01_EXECUTIVE_DOSSIER.md` — current product thesis, scope, key constraints and status.
- `02_MARKET_RESEARCH_AND_COMPETITIVE_LANDSCAPE.md` — products reviewed, observed capabilities and differentiation hypotheses.
- `03_BRAND_IDENTITY_AND_POSITIONING.md` — current working name, unapproved name/tagline candidates, positioning and launch brand tasks.
- `04_DISCOVERY_HISTORY_AND_INTERVIEW_RECORD.md` — initial product brief and Round 1–9 exact user answer values, question domains and decision reasoning.
- `05_PRODUCT_REQUIREMENTS_AND_WORKFLOWS.md` — source specification extracts plus current functional/nonfunctional requirements.
- `06_PDF_ENGINE_AND_RENDERING_SPEC.md` — PDF compatibility constraints, placeholder detection, overlays, preview and benchmark needs.
- `07_SYSTEM_ARCHITECTURE.md` — React/Vite + Hono + MongoDB + R2; browser execution and API boundaries.
- `08_DATA_MODEL_API_AND_STATE_MACHINES.md` — detailed proposed models, indexes, APIs, states and invariants extracted from v0.9.
- `09_EMAIL_DELIVERY_AND_PROVIDER_STRATEGY.md` — Nodemailer, providers, quota math, retries, webhooks and strict expiry.
- `10_SECURITY_PRIVACY_AND_RETENTION.md` — auth, uploads, authorization, privacy, retention and cleanup.
- `11_HOSTING_STORAGE_AND_ZERO_COST_CONSTRAINTS.md` — free-tier limits, public hosting blocker and resource cost implications.
- `12_ROADMAP_REPOSITORIES_CICD_AND_ENVIRONMENT.md` — milestones, separate repositories, CI/CD and environment guidance.
- `13_TEST_MATRIX_AND_ACCEPTANCE_CRITERIA.md` — testing and release acceptance gates.
- `14_DECISION_REGISTER.md` — authoritative decisions, recommendations, open questions and conflicts.
- `15_RESEARCH_REGISTER_AND_REFERENCES.md` — dated source links and research caveats.
- `16_ASSUMPTIONS_RISKS_DEPENDENCIES_AND_OPEN_ITEMS.md` — assumptions, risks, contradictions and dependencies.
- `17_CONVERSATION_ARCHIVE_GUIDE.md` — provenance, scope and how to interpret source logs.
- `18_ROUND_BY_ROUND_DECISION_TIMELINE.md` — condensed chronological cross-reference.
- `19_CHANGELOG_AND_VERSION_POLICY.md` — this pack’s change history and a policy for future updates.
- `20_CONVERSATION_ARCHIVE_AND_PROVENANCE.md` — chronological archive of user inputs, Round 1–9 selected values, assistant reasoning map, source-of-truth crosswalk and provenance notes.
- `21_ARCHIVE_MANIFEST_AND_COMPLETENESS.md` — coverage map, preserved source versions, limits and final completeness checks.
- `BULK_DOCUMENT_ISSUANCE_MASTER_DOCUMENTATION_V1.0.md` — all current topical documentation concatenated into a single Markdown reference.
- `FILE_MANIFEST.md` — file sizes and SHA-256 hashes for archive integrity checks (the manifest does not hash itself).
- `SOURCE_V0.9_FULL.md` — full unmodified v0.9 specification snapshot.
- `source-logs/` — exact decision log snapshots v0.3 through v0.9.

## Authority order

When anything conflicts, apply the following order:

1. The latest direct user statement.
2. `14_DECISION_REGISTER.md`, but only entries labelled as user-decided.
3. Recommendations, which do not count as approved until the user says so.
4. Older source logs as historical context.
5. Time-sensitive technical facts, which must be rechecked before implementation or launch.

This pack does **not** mean the user approved every proposed schema, route or brand idea. Items are labelled accordingly. The user’s selected architecture still contains feasibility gaps that require proof before public launch.

## Current product snapshot

- General-purpose document categories; PDF support is constrained to supported text-based PDFs.
- Existing PDF + CSV/XLSX as input, field mapping, full draft review, immutable snapshot, individualized PDFs and ZIP downloads.
- Intended batch target: 500–5,000 recipient records, but maximum advertised volume must wait for benchmarks.
- Browser-side processing in bounded Web Worker chunks; closing the browser pauses it, and the user can resume later.
- Hono serverless API on Vercel for a private prototype; public hosting remains unresolved under the strict $0 constraint and current plan terms.
- MongoDB for durable metadata/job state, MongoDB-backed queue direction, Cloudflare R2 for private objects.
- Google Identity Services only; secure HttpOnly session cookie; same-origin browser/API topology.
- Email is a future capability and explicitly not in the first live prototype (downloads-first). Provider selection remains open; user asked to investigate Nodemailer or equivalent.
- Strict output expiry, daily cleanup sweep and a history that retains aggregate counts/timestamps after personal data expires.
- Final brand name/tagline/logo/domain have **not** been selected.

## Deliverables

The ZIP archive contains all Markdown files, historical snapshots and source references. The all-in-one master Markdown concatenates the current topical files for easy review/import; the individual files remain easier to maintain and should be edited as the authoritative modular documentation.

## Freshness

The research in this pack was checked during discovery and rechecked while assembling the pack on 10 October 2026. Pricing, quotas, plan terms and product capabilities change. Reconfirm at implementation and launch.
