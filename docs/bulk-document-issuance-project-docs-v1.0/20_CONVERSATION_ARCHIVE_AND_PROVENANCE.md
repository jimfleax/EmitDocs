# Conversation Archive and Provenance Register

**Pack version:** 1.0  
**Scope:** The product-discovery conversation available in this project context through Round 9 and the request to create this documentation pack.  
**Use:** Long-term traceability for future product, engineering, marketing, presentation and ideation work.

## 1. Preservation policy and honest scope

This archive preserves the initial user brief verbatim in `04_DISCOVERY_HISTORY_AND_INTERVIEW_RECORD.md`, the answer values selected in Rounds 1–9, the question domains/options, the reasoning/analysis outcomes, the versioned decision logs v0.3–v0.9, current decision register, research sources, architectural specifications, state models, acceptance criteria, risks and unresolved decisions.

The source decision log snapshots in `source-logs/` are copies of the authored v0.3–v0.9 files. Do not edit those historical snapshots. `SOURCE_V0.9_FULL.md` is a full v0.9 snapshot. The pack's topical files reorganize this material so later work can find a source of truth quickly.

This directory is not a byte-for-byte export of the ChatGPT interface, hidden tool payloads, UI components, or temporary reference IDs. The interview's interactive question sets are represented through the option domains, exact user answer values, chronological decision record, and current specification. The important project decisions, research claims, alternatives, trade-offs and open issues are distributed and cross-referenced across this pack. When literal historical wording matters, consult the initial brief in `04_DISCOVERY_HISTORY_AND_INTERVIEW_RECORD.md`, the round answer records below, and the immutable source logs.

## 2. Initial user brief — verbatim

The initial brief is reproduced verbatim in `04_DISCOVERY_HISTORY_AND_INTERVIEW_RECORD.md`, section “Initial product brief (verbatim user message)”. That source should be treated as the canonical exact copy to avoid creating a divergent duplicate.

## 3. Exact Round 1–9 user answer values

The complete exact answer values are transcribed in `04_DISCOVERY_HISTORY_AND_INTERVIEW_RECORD.md`. They are indexed here for quick audit and are also summarized in the current decision register.

### Round 1 — product direction

```text
My answers to the document-automation app interview, Round 1:

1. Initial audience: general-purpose users
2. Input workflow: automatic placeholder detection plus visual fallback
3. PDF intelligence: mostly automatic detection but explicit user confirmation
4. Batch volume: 500 to 5000 recipients initially
5. Email delivery: undecided
6. File storage and privacy: temporary storage with automatic deletion
7. Main differentiator: the simplest existing-PDF workflow
8. Business model: completely free initially with possible future monetization

Additional thoughts:
No additional notes.
```

### Round 2 — actual document workflow

```text
Document automation app discovery — Round 2 answers:

1. Initial use case: all document categories from launch
2. Supported PDFs: text PDFs with automatic field suggestions
3. Placeholder mechanism preference: detect tokens and use confirmed visual overlays
4. Personalized data fields: text, dates and numbers
5. Review/approval workflow: CSV and XLSX with column mapping
6. Email delivery preference: app-managed email with individual PDF attachments
7. Data retention preference: user-configurable deletion
8. Accounts and template reuse preference: accounts with reusable templates and temporary job history
9. First extension priority / additional requirements: delivery tracking and automatic retries

Additional notes: None.
```

The phrase “Review/approval workflow” was the user's answer to the CSV/XLSX data-input question in that round. The later explicit Round 3 answer established browsing every draft before final approval.

### Round 3 — failure handling and operations

```text
Document automation app discovery — Round 3 answers:

1. Approval workflow: allow browsing every draft before final approval
2. Invalid rows and partial batches: block only affected rows and process valid rows
3. Delivery scheduling and retries: automatically throttle over time, retry transient failures and expose permanent failures
4. Sender identity: organizer email connection later
5. Unsupported PDF backgrounds: require clean placeholder areas in unsupported layouts
6. Template retention model: keep template PDF until user deletes template; expire job files separately
7. Download format: ZIP of individual PDFs with optional individual downloads
8. Accounts and team support: individual accounts only
9. Pause/resume/cancellation: pause resume and cancel unsent work

Additional notes: None.
```

### Round 4 — initially left open

```text
Bulk Document Issuance — Round 4 answers:

1. Authentication: undecided
2. Individual recipient editing: undecided
3. Multi-page support: undecided
4. Text overflow behavior: undecided
5. PDF size/page limits: undecided
6. History after personal-data expiry: undecided
7. Privacy/sensitivity scope: undecided
8. Operating budget: undecided
9. High-volume email policy: undecided
10. Performance target: background processing with accurate progress and no fixed completion promise
11. Launch approach: open registration with minimal restrictions

Additional notes: None.
```

### Round 5 — defaults and budget

```text
Bulk Document Issuance — Round 5 decisions:

1. Authentication: google-only
2. Recipient editing: both
3. Multi-page PDF support: capped-multipage
4. Text overflow: fit-then-flag
5. Limits/benchmarking: benchmark
6. History after data expiry: aggregate
7. Sensitivity scope: ordinary
8. Operating budget: strict-zero
9. Email quota policy: free-capped
10. Registration safeguards: public-guarded

Additional notes: None.
```

### Round 6 — architecture, initial answer

```text
Bulk Document Issuance — Round 6 architecture answers:

1. Frontend: react-vite
2. Backend: undecided
3. Repository: separate-repos
4. Google auth implementation: google-identity
5. PDF execution: browser
6. Background queue: mongodb-queue
7. Object storage: r2
8. Hosting topology: serverless-chunks
9. Progress transport: polling
10. Validation schemas: zod

Additional notes: None.
```

### Round 6 — additional clarification, submitted in a follow-up

```text
Bulk Document Issuance — Round 6 architecture answers:

1. Frontend: react-vite
2. Backend: undecided
3. Repository: separate-repos
4. Google auth implementation: google-identity
5. PDF execution: browser
6. Background queue: mongodb-queue
7. Object storage: r2
8. Hosting topology: serverless-chunks
9. Progress transport: polling
10. Validation schemas: zod

Additional notes: I want to use hono for fast serverless backend which I will deploy on vercel. The pdf and email sending will be proceeded in frontend.

Critically analyze these choices against the full decision log, including the hard $0 budget, and distinguish user decisions from recommendations. Research current provider details that remain uncertain. Update the implementation specification and decision log to v0.6, then continue with unresolved data models, API boundaries, job state transitions, delivery recovery, security and testing decisions without repeating answered questions.
```

The direct Hono clarification is the reason Hono is now recorded as the user-selected backend direction, despite the initial multiple-choice value being “undecided”. The browser-orchestrated plan does not authorize exposing provider secrets to client code.

### Round 7 — state, delivery and security

```text
Bulk Document Issuance — Round 7 responses:

1. Closing the browser during a job: pause-resume
2. Email execution model: frontend-hono
3. Application session: http-cookie
4. Batch approval snapshot: immutable-snapshot
5. Spreadsheet re-import reconciliation: diff-reconcile
6. Duplicate-record policy: warn-preserve
7. Visible email outcomes: distinguish
8. Ambiguous send handling: reconcile-first
9. Retry policy: bounded-retry
10. File retention presets: preset-30
11. ZIP generation approach: browser-bounded
12. Security/API boundary: strict-boundary
13. Testing and launch gate: private-first

Additional notes: None.
```

### Round 8 — deployment/retention/provider questions

```text
Bulk Document Issuance — Round 8 answers:

1. Vercel/strict-zero hosting resolution: private-prototype
2. Cookie and repository deployment topology: same-origin
3. Email provider approach: compare-providers
4. Re-import matching without stable identifier: manual-uncertain
5. Retention timer and unresolved delivery policy: completion-deadline
6. Draft preview fidelity: same-pipeline
7. Pilot workload and benchmark policy: benchmark-before-promise

Additional notes: None.
```

### Round 9 — final defaults and Nodemailer request

```text
Bulk Document Issuance — Round 9 decisions:

1. Output expiry versus pending email: strict-deadline
2. First email-provider prototype: downloads-first
3. Physical deletion delay under strict-zero hosting: daily-sweep
4. API contract between separate repositories: openapi
5. Development tooling defaults: recommended-stack

Additional notes: I want you to use nodemailer or something so that we can send more emails at a time

Analyze these against v0.8 and every prior user decision. Preserve choices and recommendations as distinct categories. Update the specification to v0.9, including any changes to retention/delivery state machines and acceptance criteria. Then propose the final remaining implementation steps without repeating answered questions.
```

### Documentation-pack request — verbatim as supplied in the current conversation

```text
Based on our conversation history, all the plans made and all the reasoning behind it, all the research completed and all the decisions made, all the choices we made and all the assumptions we had, everything should be documented. First sectionize all the data, then create md files containing ALL THE DATA FROM THE CONVERSATION HISTORY. This document should act as the complete documentation for the project. All further PRD, development, promotion, presentation, ideation will be performed on top of this.

Make sure you include ALL the conversation history - SKIP NOTHING, EACH AND EVERYTHING SHOULD BE DOCUMENTED.

Include the brand details including app name, tag lines, etc.
```

## 4. Assistant response / research content map by round

This is a topic-by-topic archive of the substance of assistant turns. It is intended to make the project's reasoning traceable without pretending that a structured Markdown pack is a raw chat UI dump.

### Before Round 1

- Framed the discovery effort as structured product discovery: market evidence, interview rounds, decisions, hypotheses and later implementation artifacts.
- Market landscape: design-first tools, credential-management platforms and lightweight browser tools already handle parts of the workflow.
- Initial differentiation hypotheses: existing-PDF-first simplicity, trustworthy preflight/review, per-recipient delivery recovery, corrections/reissue, privacy/retention and clear free-tier limits.
- PDF principle: placeholder replacement is not universal because PDFs are fixed-layout render representations. PDF.js and pdf-lib are candidate libraries for inspection/rendering and drawing/modification, not proof of arbitrary text erasure.
- Queue principle: independent job/recipient states, retries and durable records are required; free hosting is not equivalent to reliable production hosting.

### After Round 1

- Challenged “general-purpose” as a launch segment, while retaining it as the long-term product category.
- Highlighted tension between easy arbitrary PDF detection and predictable layout correctness.
- Recommended decoupling generation from email delivery.
- Described a controlled hybrid: upload PDF, suggest tokens/positions, confirm mappings, validate, preview, generate independently, download and later deliver.

### After Round 2

- Recommended a documented compatibility boundary for text-based PDFs; unsupported backgrounds must not be silently masked.
- Explained why overlays do not inherently erase underlying content.
- Proposed per-recipient states and idempotent operations rather than treating the entire batch as one monolithic job.
- Separated persistent template/source PDF from temporary recipient data and job output.

### After Round 3

- Recommended a searchable/paginated draft gallery and on-demand preview so every draft is inspectable without materializing all outputs simultaneously.
- Compared free-tier constraints for MongoDB, R2, Redis/queue options, email and serverless hosting.
- Emphasized that MongoDB TTL indexes and R2 lifecycle rules are asynchronous; physical deletion must be tracked and communicated accurately.
- Identified free-tier email quotas and 5,000-message delivery delays as significant product UX constraints.

### After Round 4

- Preserved most Round 4 responses as undecided.
- Recommended a secure, low-friction authentication approach, immutable approval data, strict API secret boundaries and measured workload limits.
- Called out open registration versus email-abuse risk and the need for quotas, sending authorization, bounce/complaint suppression and an emergency disable switch.

### After Round 5

- Recorded the user-selected core stack direction and strict zero budget.
- Explained that Google sign-in must be verified server-side and still needs an app session.
- Explicitly cautioned that browser-side processing pauses when browser execution ends and that 5,000 batch performance is a target pending benchmark, not a promise.

### After Round 6

- Applied the explicit user clarification selecting Hono on Vercel for a private prototype and browser-side PDF processing.
- Drew a boundary: frontend may initiate/coordinate work, but email-provider credentials and actual send calls stay in Hono/server-side code.
- Proposed OpenAPI-compatible service contracts for separate repositories, R2 direct signed uploads/downloads, MongoDB state and polling.

### After Round 7

- Locked the user's choices for pause/resume, cookie session, immutable snapshot, diff/reconcile, duplicates warn/preserve, detailed email states, ambiguous-send reconciliation, retention presets, browser-bounded ZIP and private-first testing.
- Highlighted that “exactly-once email” is not guaranteed by queues alone; duplicate prevention and reconciliation must be implemented around provider acceptance events.
- Noted that email delivery can pause when the browser closes under the chosen orchestration model.

### After Round 8

- Recorded Vercel Hobby as a private prototype only; public hosting remains open due to current terms and hard-zero-cost constraint.
- Proposed comparing providers and making retention semantics explicit.
- Recommended strict manual reconciliation when a re-import cannot be reliably matched by a unique stable key.
- Reinforced preview/final-generation parity and benchmark-before-promise.

### After Round 9

- Locked strict output expiry, downloads-first initial prototype, daily cleanup sweep, OpenAPI and recommended developer tooling.
- Addressed Nodemailer: it can use pooled SMTP connections and reduce transport overhead, but it does not itself provide email service or bypass provider quotas. Provider-level message caps still apply.
- Compared Brevo (research candidate with higher published free daily cap), Resend (lower free cap), and AWS SES (not assumed permanently free); provider remains unselected.
- Warned that the strict expiry deadline conflicts with long send queues: unsent work must become `expired_unsent` at expiry unless user revises the requirement. The initial prototype avoids this because email is disabled.

## 5. Conversation topics and exact source of truth

| Topic | Primary record |
|---|---|
| Initial brief and round response values | `04_DISCOVERY_HISTORY_AND_INTERVIEW_RECORD.md`; exact blocks above |
| Interview scope and round sequence | `04_DISCOVERY_HISTORY_AND_INTERVIEW_RECORD.md`, `18_ROUND_BY_ROUND_DECISION_TIMELINE.md` |
| Decisions vs recommendations | `14_DECISION_REGISTER.md` |
| Historical decision-log state at each version | `source-logs/document-automation-decision-log-v0.3.md` through `v0.9.md` |
| Full v0.9 authored decision log | `SOURCE_V0.9_FULL.md` |
| Product requirements and workflows | `05_PRODUCT_REQUIREMENTS_AND_WORKFLOWS.md` |
| PDF limitations and engine plan | `06_PDF_ENGINE_AND_RENDERING_SPEC.md` |
| Current architecture | `07_SYSTEM_ARCHITECTURE.md` |
| Data models, API, state machines | `08_DATA_MODEL_API_AND_STATE_MACHINES.md` |
| Email/Nodemailer/quota research | `09_EMAIL_DELIVERY_AND_PROVIDER_STRATEGY.md` |
| Security and data lifecycle | `10_SECURITY_PRIVACY_AND_RETENTION.md` |
| Hosting/free-tier constraints | `11_HOSTING_STORAGE_AND_ZERO_COST_CONSTRAINTS.md` |
| Roadmap/repositories/CI/environment | `12_ROADMAP_REPOSITORIES_CICD_AND_ENVIRONMENT.md` |
| Acceptance and test matrix | `13_TEST_MATRIX_AND_ACCEPTANCE_CRITERIA.md` |
| Market evidence | `02_MARKET_RESEARCH_AND_COMPETITIVE_LANDSCAPE.md`, `15_RESEARCH_REGISTER_AND_REFERENCES.md` |
| Brand decisions and unapproved brainstorming | `03_BRAND_IDENTITY_AND_POSITIONING.md` |
| Risks/open issues | `16_ASSUMPTIONS_RISKS_DEPENDENCIES_AND_OPEN_ITEMS.md` |

## 6. How to continue discovery without losing context

Every future product or engineering decision should be logged as one of: USER-DECIDED, USER-PREFERENCE/TARGET, RECOMMENDATION, TECHNICAL FACT (DATED), OPEN, DEFERRED, or CONFLICT/RISK. A new user instruction supersedes a prior decision only when the user clearly changes it. Update the decision register and affected files, add dated research references when facts may change, and preserve old source logs unchanged.
