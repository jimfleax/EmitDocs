# Bulk Document Issuance — Master Project Documentation v1.0

**Assembled:** 10 October 2026  
**Primary specification snapshot:** decision log v0.9.

This file consolidates the current modular documentation for convenient reading/import. For ongoing maintenance, the individual numbered files are authoritative and should be edited in parallel. The exact historical decision-log snapshots v0.3–v0.9 are preserved in `source-logs/`.

---


---

<!-- Source file: 00_README_AND_INDEX.md -->

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


---

<!-- Source file: 01_EXECUTIVE_DOSSIER.md -->

# Executive Project Dossier

## Product in one paragraph

Build a web app that takes an existing PDF design and structured records, helps the user map data fields to placeholders or visually confirmed regions, lets them review every personalized draft, freezes the approved data/template configuration, and produces individual PDFs. Users can download the results as a ZIP or individual files. App-managed email with one PDF per recipient is intended for a later milestone; it is deliberately excluded from the first live prototype. Future directions include lightweight PDF editing, corrections/reissues, credential verification, integrations and team functionality, none of which are all committed to the MVP.

## Product thesis

The problem is not just replacing names. Organizers can spend time matching data to a design, correcting spelling, preserving layout, generating hundreds/thousands of files, matching each document to the right email, handling bounced/rejected sends, recovering interrupted jobs, and explaining what was sent or deleted. The proposed value is a low-friction, dependable existing-PDF-first workflow.

This is a product hypothesis, not a validated advantage. Competitive tools already support many isolated features such as bulk generation, field placement, browser processing, ZIP download, email, and verification.

## Current product shape

- General-purpose by document category, not limited to certificates.
- Text-based PDF support with automatic field suggestions and user-confirmed visual mapping/overlays; no promise of universal PDF manipulation.
- CSV/XLSX input with field mapping; text, dates and numbers.
- Full draft browsing before approval; row-level errors; inline edits and spreadsheet re-import.
- Ambiguous re-import matching must be resolved manually; duplicates warn and are preserved.
- Approval freezes an immutable snapshot of data and template/mapping versions.
- Browser processing in bounded Web Worker chunks; closing the browser pauses work; returning allows resume.
- Persisted progress, polling, ZIP + individual downloads, configurable temporary retention.
- Template PDF remains until template deletion; job files expire separately.
- Downloads-first private prototype; app-managed email later.
- Individual accounts only; collaboration/teams deferred.

## Confirmed technology direction

| Layer | Current direction | Decision status |
|---|---|---|
| Frontend | React + Vite + TypeScript | User-selected |
| API | Hono + TypeScript | User-specified; Vercel for private prototype |
| Repositories | Separate web and API repos | User-selected |
| Authentication | Google Identity Services only | User-selected |
| App session | HttpOnly cookie; same-origin API topology | User-selected; exact security implementation still needs tests |
| Validation | Zod | User-selected |
| API contract | OpenAPI between repositories | User-selected |
| Metadata/job state | MongoDB | User-selected foundation |
| Queue direction | MongoDB-backed work records | User-selected direction; needs explicit dispatcher/claims/leases |
| Objects | Cloudflare R2 | User-selected candidate; quota caps required |
| PDF | PDF.js for inspection/rendering; pdf-lib for drawing/modification | Recommended library combination, not arbitrary text replacement |
| Execution | Browser Web Worker chunks; pause/resume | User-selected |
| Progress | Poll persisted API/database state | User-selected |
| ZIP | Browser-bounded archive creation | User-selected; needs benchmarks |
| Email | Not in first prototype; provider undecided | User-selected sequence |
| Email library | Nodemailer or equivalent to investigate | Request to investigate, not package decision |
| Testing | Node LTS, npm, Vitest, Playwright, GitHub Actions | User-selected recommended-stack default |

## Main conflicts to manage explicitly

### Strict $0 vs production-grade autonomous work
Free/serverless services have limits. Browser processing pauses after close. If the product later needs autonomous all-night jobs, a persistent worker may require revisiting hosting/budget constraints.

### Strict expiry vs free-capped email
A 5,000-email batch may take 17 days at a 300/day limit or at least 50 days at a 100/day limit (the latter also has a monthly cap), much longer than 24-hour or 7-day retention. The selected rule is strict deadline: stop unsent work when outputs expire, mark `expired_unsent`, and do not keep files alive silently.

### General-purpose categories vs constrained PDFs
All document categories from launch does not mean all PDF files/layouts are supported. Unsupported backgrounds should fail safely or require clean placeholder areas.

### Vercel Hobby vs future public app
Vercel Hobby terms are for personal/non-commercial use. It is selected for the private prototype only, not a confirmed public launch solution.

### Efficient mail code vs provider quota
Nodemailer can pool connections and reduce overhead. It does not increase free account quotas or guarantee inbox delivery.

## Open decisions

Final name/tagline/logo/domain; launch niche for user testing; public hosting under $0; exact max file/page/field/row/archive limits; final provider; exact provider account eligibility and attachment behavior; actual deployment cookie/domain configuration; measured browser memory/performance; exact OpenAPI generator; and future feature priorities.

## MVP success condition

A private tester can upload a supported PDF and CSV/XLSX, map fields, fix row errors, review every draft, approve an immutable snapshot, generate correct PDFs in the browser without freezing the interface, download outputs, resume after interruption, and see temporary deletion tracked. Real email remains disabled until the PDF/download pipeline, retention and recovery pass acceptance tests.


---

<!-- Source file: 02_MARKET_RESEARCH_AND_COMPETITIVE_LANDSCAPE.md -->

# Market Research and Competitive Landscape

**Research snapshot:** 10 October 2026  
**Status:** Desk research and competitive hypotheses; not a substitute for user interviews, hands-on competitor tests, or legal/provider review.

## 1. Why this section exists

The original product brief requested research into existing apps, unmet user needs, differentiation, retention and useful features. The aim is not to claim the category is empty. There are existing design, credentialing, certificate-generation and bulk-email products. Differentiation must come from the exact combination of workflow and reliability.

Evidence categories used here:

- **Documented capability:** described in a vendor's product/help/API documentation.
- **Vendor claim:** a capability or benefit stated by the product itself, not independently measured.
- **Anecdotal signal:** one or a small number of reviews, not proof of a broad problem.
- **Product hypothesis:** something to validate with prospective users.
- **Constraint:** a technical, business or provider limit to test before promising a feature.

## 2. Competitor and adjacent-product landscape

### 2.1 Canva Bulk Create

**Category:** Design-first visual content generation.

**Research notes:** Canva's Bulk Create workflow connects data to design elements and supports field matching, manual mapping and previews. The reviewed help documentation described a limit of 300 rows and 150 columns per selection. Canva's strength is flexible design and an established editor. This does not establish that it is optimized for arbitrary-PDF field replacement, durable per-recipient email state, retries, retention policy and post-issuance audit workflows.

**Implication:** Do not differentiate only on “bulk generation” or “preview”. More specific opportunity hypotheses include using an existing PDF without recreating it in a proprietary editor, dependable handling of a large batch, recipient-level recovery and an understandable privacy lifecycle.

Source: https://www.canva.com/help/bulk-create/

### 2.2 Certifier

**Category:** Digital credentials and certificates.

**Research notes:** Certifier operates in the credential-management market and documents bulk issuance and credential workflows. Plan limits and feature availability may depend on subscription; one plan guide reviewed during discovery listed an annual credential allowance on a starter tier. Plan terms must be rechecked before making any current competitive comparison.

**Implication:** Existing competitors can already address bulk issuance, branding, delivery and verification. A new product needs a clear distinction—especially existing-PDF simplicity, privacy/retention, or per-recipient operational recovery—rather than a generic certificate feature list.

Sources:
- https://certifier.io/features
- https://certifier.io/features/generator
- https://support.certifier.io/en/articles/10806136-guide-to-certifier-plans

### 2.3 Accredible

**Category:** Credential-management platform and APIs.

**Research notes:** Accredible provides credential issuance and API-oriented workflows. API and bulk-operation limits depend on the relevant product/account configuration and must be checked against current documentation.

**Implication:** For customers requiring verified credentials, branded public profiles or an existing institutional credential system, a general-purpose PDF generator may not replace a full credential platform. We can start with documents and later add IDs/QR verification only if user demand supports it.

Source: https://docs.api.accredible.com/

### 2.4 Cgenerate

**Category:** Lightweight certificate generator.

**Research notes:** The project's public repository describes browser-oriented generation, CSV/XLSX/Google Sheets input, image/PDF templates or assets, field placement, validation and ZIP output; the README reviewed during discovery mentioned a 1,000-recipient-per-file limit. The repository is evidence of a relevant direct alternative, but capabilities should be tested hands-on before claiming exact comparisons.

**Implication:** A free service with browser-side generation and basic spreadsheet import is not sufficient differentiation on its own. Larger batches, reliable PDF text-template workflows, preview quality, re-import reconciliation and a clear email state model are candidate differentiators to validate.

Source: https://github.com/cgenerate/cgenerate

### 2.5 MailMyCertificate

**Category:** Lightweight/browser-oriented certificate generation and delivery.

**Research notes:** Its site advertises browser-local generation, CSV/Google Sheets-oriented input and Gmail-oriented delivery workflows. These claims indicate that users already have alternatives for simple generation and that privacy-oriented local processing is not unique to our concept.

**Implication:** Browser-local generation can support the $0 infrastructure goal but should not be marketed as novel. Our product needs a sharper promise around supported existing PDFs, safe preview/review, resumable generation, usable outputs and explicit expiry behavior.

Source: https://www.mailmycertificate.tech/

### 2.6 Give My Certificate — user-review signal

**Category:** Certificate generation.

**Research notes:** One January 2026 G2 review reviewed during discovery praised bulk issuance/automation but mentioned editor limitations, preview lag and limited flexibility for changes after issuance. This is an **anecdotal signal from one review**, not evidence of the prevalence of these problems or that the product broadly fails users.

**Product hypotheses to test:**

- Users may want an easy way to correct a recipient's spelling without rebuilding an entire batch.
- Users may value a reliable preview that faithfully matches final output.
- Users may want a clear correction/reissue history.
- Users may prefer to bring an already-designed PDF rather than reconstruct the design in a new editor.

Source: https://www.g2.com/products/give-my-certificate/reviews

## 3. What is already commoditized

The following are not safe differentiators by themselves because alternatives already provide similar capabilities in some form:

- CSV/spreadsheet upload.
- Bulk generation of certificates or documents.
- Field mapping and previewing.
- Downloading generated files in a ZIP.
- Some form of email delivery.
- Some form of template/design editing.
- Free or browser-local generation.

The exact feature limits differ by product and plan; this list is a market-level warning against generic positioning rather than a claim of feature parity.

## 4. Differentiation hypotheses

These remain hypotheses, not confirmed competitive advantages.

### H1. Existing-PDF-first workflow

Allow an organizer to retain the approved design and map variable fields, rather than requiring full recreation in an editor. This is valuable only if visual fidelity is reliable on supported PDFs and unsupported layouts fail safely.

### H2. Preflight and dependable output

Validate all rows, surface missing values, estimate text overflow, preview representative records, and offer a searchable gallery for every draft before approval. The output must match the preview because both use the same generation pipeline.

### H3. Failure-resilient operation

Keep per-recipient generation and delivery states, bounded retry history, explicit failure reasons and a workflow that allows one recipient's failure to leave other recipients unaffected.

### H4. Corrections without losing accountability

Support edits before approval, versioned snapshots, and future correction/reissue flows. A correction should not silently mutate a document that has already been generated or sent.

### H5. Privacy with predictable expiration

Offer explicit job-file retention presets and clean separation between reusable templates and temporary job inputs/outputs. Do not claim instant physical deletion when provider deletion is asynchronous.

### H6. Free, transparent and useful for occasional users

A free product may serve occasional organizers well, but email quotas must be disclosed. “Free” should not imply unlimited messages, unlimited PDFs, instant processing or guaranteed delivery.

## 5. Retention and engagement ideas

“Keep users hooked” should mean repeat usefulness and trust, not manipulative engagement. Candidate retention features are:

- Reusable template configuration so the next event does not require remapping.
- Recent job summaries and transparent result counts.
- Explicit renewal/re-run from a template with a new data file.
- Error reports and easy correction/re-import.
- Clear re-download availability within configured retention.
- Later, correction/reissue workflow and optional public verification.

Do not retain participants' personal data indefinitely merely to increase engagement. Reusable template configuration can outlive the temporary recipient dataset.

## 6. Known product gaps / unvalidated user pains

The conversation did not include interviews with actual target users. These questions are therefore **unvalidated**:

- How often organizers must recreate already-designed certificates in a new tool.
- How commonly arbitrary existing PDFs contain searchable standardized placeholders.
- How frequently long names or complex backgrounds cause visible corruption.
- Whether teams actually require delivery tracking or mostly want immediate download.
- Whether a 17–50 day delivery window is acceptable for a free 5,000-recipient batch (likely unsuitable for time-sensitive events; validate directly).
- Whether users prefer attached PDFs or secure links.
- Whether users would pay for larger quotas, faster processing, custom domains, editing or verification.
- Whether templates are reused often enough to drive repeat use.

## 7. Research method for the next validation stage

1. Recruit organizers from at least three segments (e.g. college/event, education/training, small business/NGO).
2. Ask them to walk through their last real bulk-document event rather than asking only hypothetical feature preferences.
3. Request a sample PDF and anonymized input spreadsheet; observe the existing workflow and time required.
4. Test competitors hands-on using the same sample data and measure setup time, fidelity, review burden, failure recovery and export time.
5. Separate must-have behavior from feature requests; prioritize problems that occur often and have meaningful cost.
6. Update this section with date, evidence, segment, method and confidence level. Do not convert a single anecdote into a universal claim.

## 8. Current strategic recommendation

Build a general-purpose underlying document engine but constrain the initial **file compatibility contract** to supported text-based PDFs and clean variable-field areas. Start with downloads-first. Make preview fidelity, row-level correctness, resumable browser processing, secure temporary storage and reliable cleanup demonstrable before enabling public bulk email.

This recommendation respects the user's choices while reducing the biggest early failure modes: promising arbitrary PDF manipulation, depending on free email quotas for urgent high-volume delivery, and building a sophisticated editor before the core workflow has been validated.


---

<!-- Source file: 03_BRAND_IDENTITY_AND_POSITIONING.md -->

# Brand Identity and Positioning — Exploratory, Not Approved

## Current brand status

No final app name, tagline, logo, color palette, typography, domain, brand voice, or trademark has been selected in the discovery conversation. The user explicitly asked that brand details be documented; the correct record is that final branding remains open.

**Working project/codename:** Bulk Document Issuance. This is descriptive project terminology, not a confirmed consumer-facing app name.

## Positioning foundation

**Category:** General-purpose document personalization and bulk issuance web app.

**Core job:** A user already has a PDF design and structured recipient data. The app helps them map fields, check the data and layout, review every draft, and generate a batch of individual documents without manually editing each file.

**Positioning hypothesis:** “The simplest trustworthy way to personalize documents from a PDF you already have.” This is a hypothesis based on the discovery conversation, not validated differentiation or approved marketing copy.

**Long-term audience:** General-purpose users. Likely segments for validation include event organizers, college clubs, hackathons, workshops/webinars, education/training providers, NGOs, and small HR/business teams. No first launch niche is selected.

## Tagline candidates (brainstorming only)

1. **One template. Every document. Ready to send.** — practical, broad; recommended working candidate, not approved.
2. **Your PDF. Thousands of personalized documents.** — direct capability statement; risks overpromising scale before benchmark results.
3. **From one design to every recipient.** — clear and compact; less explicit about download/delivery.
4. **Personalized documents, without the busywork.** — benefit-oriented and general-purpose.
5. **Create once. Issue confidently.** — emphasizes accuracy and confidence.
6. **Bulk documents, handled beautifully.** — friendly but generic.
7. **One file in. A batch ready out.** — process-focused; may feel technical.
8. **Make every document feel individual.** — warm, but less immediately descriptive.

No tagline should claim guaranteed delivery, arbitrary PDF compatibility, instant deletion, or unlimited free sending unless tested and supported.

## Unvetted name candidates

These names were brainstormed for this documentation pack only; they were **not** selected by the user and have not undergone trademark, domain, app-store or search-collision checks.

| Candidate | Intended impression | Potential fit | Consideration |
|---|---|---|---|
| FolioFlow | Documents moving through a workflow | Broad, general-purpose | Common word combination; check collisions |
| Batchmark | Batch + mark/credential | Good for document issuance | Could sound certificate/print-specific |
| DocuSpring | Documents generated from a source | Friendly, broad | “Docu” naming is crowded |
| IssueKit | Issuance toolkit | Clear utility | May be confused with software issue-tracking |
| PaperPilot | Guided document workflow | Friendly, easy to visualize | Likely name/domain competition; verify |
| DraftDrop | Review and distribution | Focuses on handoff | “Draft” may imply unfinished output |
| FolioBatch | Documents in batches | Descriptive | Less distinctive |
| Issuely | SaaS-like issuance name | Short | Must check similar marks/domains |
| Sendfolio | Documents + distribution | Useful if delivery becomes core | May overemphasize sending versus downloads |
| ClearIssue | Clarity/reliability | Trust-oriented | Must check industry/name conflicts |

## Possible brand territories

### Utility-first and trustworthy
A clear functional name with modest promises, ideal for a product whose selling points are correctness, privacy, recoverability and transparent status.

### Friendly productivity
A short name and benefit-led copy centered on reducing repetitive work and preserving the design users already have.

### Issuance infrastructure
A name that can later support templates, reissues, verifications and API workflows; avoid locking the brand to certificates only.

## Suggested voice guidelines (recommendation)

- Clear, precise, calm and practical.
- Say “suggests fields for confirmation,” not “understands any PDF perfectly.”
- Distinguish “accepted by provider” from “delivered.”
- Show progress, retry and expiry status plainly.
- Do not imply that batching or Nodemailer bypasses provider quotas.
- Avoid absolute security/deletion claims.
- Do not imply official accreditation or authenticity verification unless those functions are built and their trust model is defined.

## Visual direction (not approved)

Potential visual metaphor: a page becoming several aligned pages; a document corner with a subtle grid/check; or a field-placement/cursor mark. Avoid using only a certificate seal as the logo because the product is general-purpose. No palette, font, icon style, wordmark or favicon has been approved. Any future visual system should prioritize accessibility and never use color alone for error states.

## Brand tasks before launch

1. Interview target users and test name comprehension.
2. Shortlist 3–5 candidates after domain and trademark screening.
3. Test taglines with a five-second explanation exercise.
4. Check domains and social handles.
5. Check trademark availability in intended markets/industries.
6. Produce a wordmark, icon, favicon and accessible design tokens.
7. Align public copy with supported PDF types, measured batch limits, deletion mechanics and actual email quotas.


---

<!-- Source file: 04_DISCOVERY_HISTORY_AND_INTERVIEW_RECORD.md -->

# Discovery History and Interview Record

This file records the initial brief, exact selected answer values from Rounds 1–9, the question areas/options considered, and the main reasoning/results of each round. The complete authored decision log snapshots v0.3–v0.9 remain in `source-logs/`. This is a product-relevant history, not a byte-for-byte export of every user-interface render or tool message.

## Initial product brief (verbatim user message)

> I want to ideate an app idea with you. This webapp will be used by organizers and other people to share and issue certifications and other customized documents, and send them via email (or simply downloading them).
>
> In this app, the organizer or anyone will just upload a pdf document, and the app will use advanced PDF manipulation to find the placeholder for the name, and then generate customized PDF from a list of names. The placeholder simply will be edited to convey the names in a list. For example, after an event, the organizer can simply upload a list of attendees, and a pdf design for certificate of participation, and in that there will be a placeholder (it may be standardized to some text) and the app will automatically change the placeholder and generate certificate for each attendees. These certificates can either be downloaded, or sent to the attendees to their emails. If the organizer has a list of their emails, that can be used to send.
>
> We will be using free hosting and providers, so if sending so many emails as once is a problem, we can send in batches automatically using a pipeline queuing system. This can run with a state management so that it runs in the background and there should be proper error handles in case some of them can't be sent due to error, and it should not block the other emails.
>
> The whole mechanism should be robust and efficient, with proper system design.
>
> The future plans include adding features to edit the pdf as it happens in canva and other pdf editors. This will allow minimal editing features to make sure the organizers have full control over the customization. For now our efficient methods should ensure that the names and other details are correctly filled from a data file.
>
> I want you to check the current state of the requirements and trends, and find what people lack and what problems affect the existing apps that work similarly. Find how things can be different here. Find how we can keep users hooked and what feature will be helpful for people.
>
> My tech stack is going to be typescript+nodejs+mongodb etc.
>
> I want you to ask me multiple questions using your ask question tool, and interview me comprehensively to understand the idea, ideate with me, have conversations with me to plan the complete app idea and implementation. By the end of the questions and interviewing we should know the app idea, technical feasibility and implementation details, feature list, a good grasp of the complete architecture of the app and workflow of each feature and functionality, and the tech stack used, and hosting details for both now and future. Also discuss future plans with me.

## Initial product brief

The user wanted a web app used by organizers and other people to share and issue certificates/customized documents. The organizer uploads an existing PDF containing a placeholder (possibly standardized), uploads a list of names and optionally email addresses, and the app automatically generates individualized PDFs. Documents can be downloaded or emailed. High-volume email should use batches/queueing and persistent state, robust error handling, and failures for some addresses must not block other emails. The future direction includes lightweight PDF-editing functionality comparable in spirit to Canva/PDF editors. The first release should use an efficient, reliable method for filling fields from data. Preferred stack: TypeScript, Node.js, MongoDB “etc.” The user asked for current market research, understanding deficiencies in existing apps, differentiation/retention feature ideation, and a comprehensive interview covering concept, technical feasibility, complete feature list, architecture, workflows, stack, hosting now and later, and future plans.

## Round 1 — Product direction and MVP scope

### Question areas and options shown

1. Audience: college/event organizers; schools/training; corporate HR; NGOs/professional communities; general-purpose; or research first.
2. PDF workflow: standardized placeholders; visual coordinate mapping; automatic detection + visual fallback; or near-arbitrary OCR/detection.
3. Automation: predictable supported templates; mostly automatic with confirmation; minimal setup for arbitrary PDFs; or recommend balance.
4. Batch size: ≤50; 50–500; 500–5,000; >5,000; or start small/design larger.
5. Email: app-managed; organizer mailbox; both; downloads first; or compare first.
6. Storage: persistent; temporary; browser-local; user-configurable; or investigate.
7. Differentiator: simple PDF workflow; reliability/delivery; affordability; privacy; lightweight editor; or research.
8. Business model: free core/paid upgrades; free initially; per document/batch; organization subscriptions; open source; or research.

### Exact user answers

1. Initial audience: **general-purpose users**.
2. Input: **automatic placeholder detection plus visual fallback**.
3. PDF intelligence: **mostly automatic detection but explicit user confirmation**.
4. Batch volume: **500 to 5000 recipients initially**.
5. Email: **undecided**.
6. Storage: **temporary storage with automatic deletion**.
7. Differentiator: **the simplest existing-PDF workflow**.
8. Model: **completely free initially with possible future monetization**.
9. Additional notes: **none**.

### Reasoning recorded

The product is more than name replacement: it must reduce data matching errors, preserve the original layout, preview/validate, handle long names, generate many outputs, send and track individual deliveries, and support corrections/retries. Market differentiators were hypotheses: existing-PDF-first simplicity, reliable preflight/review, per-recipient recovery, corrections/reissue, flexible delivery and affordability for occasional users. Those hypotheses were not yet market-validated.

## Round 2 — Workflow and input compatibility

### Question areas and alternatives

1. Initial use case: event certificates; education/training; letters/invitations; business/HR; all categories; research first.
2. PDF support: text PDF with known placeholders/manual fallback; text PDF with automatic suggestions; scanned PDF/OCR; almost any PDF; formal compatibility spec.
3. Mapping: token replacement when supported; token detection + overlay; visual mapping primary; or hybrid including form fields.
4. Fields: text/date/number; add IDs/QR; add images; all fields; start simple.
5. Data: CSV/XLSX; plus paste; plus Google Sheets; broader integrations; minimal input set.
6. Approval: row validation + sample; browse every draft; sample plus optional inspection; generate first and correct after; or recommendation.
7. Email: downloads first; attachments; secure links; both; organizer mailbox; compare first.
8. Retention: delete soon; 7 days; 30 days; separate template/job; user-configurable; or research.
9. Accounts: no account; optional saving; reusable templates/history; team workspaces; or decide later.
10. First extension: delivery/retries; corrections/revoke; QR verification; editor; teams; integrations/API; or prioritize later.

### Exact user answers

1. Use case: **all document categories from launch**.
2. PDF: **text PDFs with automatic field suggestions**.
3. Mechanism: **detect tokens and use confirmed visual overlays**.
4. Variable fields: **text, dates and numbers**.
5. Data: **CSV and XLSX with column mapping**.
6. Review: **allow browsing every draft before final approval**.
7. Email: **app-managed email with individual PDF attachments**.
8. Retention: **user-configurable deletion**.
9. Accounts/templates: **accounts with reusable templates and temporary job history**.
10. Priority: **delivery tracking and automatic retries**.
11. Additional notes: **none**.

### Reasoning recorded

“Any document category” was separated from “any PDF layout”: use cases can be broad, while supported file formats and masking behavior remain constrained. Arbitrary PDF text replacement is harder than drawing overlays; patterned backgrounds may require clean placeholders. The review gallery should be paginated/searchable/on-demand rather than forcing a human to open thousands of full files individually. Template source retention should be separate from temporary job data.

## Round 3 — Failure handling, trust and operations

### Question areas/options

1. Approval: sample approval, auto-start after sample, review every draft, or recommendation.
2. Invalid data: affected rows only; block batch; warning-only; strict/partial choice; or recommendation.
3. Email throttling: schedule automatically/retry transient; pause on quotas; send current allowance then manual restart; auto/manual; or research.
4. Sender identity: platform with reply-to; verified custom domain; both; postpone mailbox integration; or research.
5. PDF backgrounds: user mask confirmation; require clean field area; auto mask with warning; constrain overlays; or prototype.
6. Template retention: keep template PDF; store config only; user chooses; or delete all files.
7. Downloads: ZIP + individual; individual only; also combined PDF; one archive; or decide later.
8. Account structure: individual; organization workspace; roles; individual first and team-ready; or research.
9. Controls: pause/resume/cancel unsent; pause/resume only; cancel pending; or decide.

### Exact user answers

1. Approval: **allow browsing every draft before final approval**.
2. Invalid rows: **block only affected rows and process valid rows**.
3. Email: **automatically throttle over time, retry transient failures and expose permanent failures**.
4. Organizer mailbox: **later**.
5. Unsupported PDF backgrounds: **require clean placeholder areas in unsupported layouts**.
6. Template PDF: **keep until user deletes template; expire job files separately**.
7. Downloads: **ZIP of individual PDFs with optional individual downloads**.
8. Accounts: **individual accounts only**.
9. Controls: **pause, resume and cancel unsent work**.
10. Additional notes: **none**.

### Reasoning recorded

Track generation and delivery independently. Email provider acceptance is not proof of delivery. Canceling cannot retract completed generation or an already accepted email. A saved template requires retaining the original template PDF; job sources/outputs have separate expiration.

## Round 4 — Security, performance, retention, budget

### Question areas

Authentication choice; inline editing vs spreadsheet-only; single vs multi-page PDFs; shrink/wrap/flag behavior; fixed PDF limits vs benchmark; historical data after expiry; sensitivity class; zero budget vs small budget; free email quota behavior; and beta/public launch gate.

### Exact user answers

1. Authentication: **undecided**.
2. Inline editing: **undecided**.
3. Multi-page: **undecided**.
4. Overflow: **undecided**.
5. PDF limits: **undecided**.
6. History after expiry: **undecided**.
7. Sensitivity: **undecided**.
8. Budget: **undecided**.
9. Email policy: **undecided**.
10. Performance: **background processing with accurate progress and no fixed completion promise**.
11. Registration: **open registration with minimal restrictions**.
12. Additional notes: **none**.

### Reasoning recorded

Open registration is an acquisition preference, not removal of abuse protection. Bulk email requires sender verification, quotas/rate limits, bounce/complaint suppression, abuse reporting and a kill switch. Progress should be persisted, not in-memory only. Free-tier hosting is not an availability guarantee.

## Round 5 — Defaults and constraints

### Question areas

Google-only vs managed/passwordless auth; inline edits + import vs one method; multi-page support; overflow handling; benchmark vs fixed limits; history after expiry; privacy sensitivity; budget; email cap strategy; guarded signup.

### Exact user answers

1. Authentication: **google-only**.
2. Editing: **both** (inline edits and spreadsheet re-import).
3. Multi-page: **capped-multipage**.
4. Overflow: **fit-then-flag**.
5. Limits: **benchmark**.
6. Post-expiry history: **aggregate**.
7. Sensitivity: **ordinary**.
8. Budget: **strict-zero**.
9. Email quota: **free-capped**.
10. Launch: **public-guarded**.
11. Additional notes: **none**.

### Reasoning recorded

Google sign-in does not itself create an app session. Server-side verification and secure session flow are still needed. A hard ₹0 budget constrains persistent workers, large-volume mail, storage and public-host terms. Inline editing/re-import requires deterministic reconciliation and immutable approved data. Overflow must not silently clip or overlap.

## Round 6 — Architecture and explicit Hono clarification

### Question domains/options considered

Frontend React/Vite vs Next; Express vs Fastify; mono vs separate repos; managed auth vs direct Google; hybrid/server/browser PDF; BullMQ/Redis vs MongoDB queue vs managed queue; R2 vs Supabase vs S3; single/separate/serverless deployment; polling vs SSE/WebSocket; Zod vs JSON Schema.

### Initial exact user answers

1. Frontend: **react-vite**.
2. Backend: **undecided**.
3. Repository: **separate-repos**.
4. Auth: **google-identity**.
5. PDF execution: **browser**.
6. Queue: **mongodb-queue**.
7. Object storage: **r2**.
8. Hosting: **serverless-chunks**.
9. Progress: **polling**.
10. Validation: **zod**.

### Additional user statement

> I want to use hono for fast serverless backend which I will deploy on vercel. The pdf and email sending will be proceeded in frontend.

### Exact clarification interpretation in the specification

Hono is the selected backend direction. PDF work is in browser. The frontend can initiate/orchestrate email chunks, but API key/actual send call stays in Hono/server-side. Vercel is for a private prototype under current terms. Browser-close pauses CPU work; resume later from persisted checkpoints. MongoDB queue documents still need a process that claims/executes work.

## Round 7 — Durable state, delivery, privacy boundaries

### Question domains/options considered

Browser-close behavior; frontend vs separate worker email; cookie vs memory token; immutable snapshot; re-import diff; duplicate policy; detailed statuses; ambiguous sends; retry count/backoff; retention presets; ZIP memory strategy; strict server boundary; private-first testing.

### Exact user answers

1. Browser closing: **pause-resume**.
2. Email: **frontend-hono**.
3. Session: **http-cookie**.
4. Approval: **immutable-snapshot**.
5. Re-import: **diff-reconcile**.
6. Duplicates: **warn-preserve**.
7. Email status: **distinguish**.
8. Ambiguous send: **reconcile-first**.
9. Retry: **bounded-retry**.
10. Retention: **preset-30** (24h, 7 days, 30 days; MVP max 30 days).
11. ZIP: **browser-bounded**.
12. Security: **strict-boundary**.
13. Testing gate: **private-first**.
14. Additional notes: **none**.

### Reasoning recorded

The snapshot freezes effective row values including overrides, template checksum/version, mappings/formatting and approval metadata. Re-import matches reliable unique keys only; uncertain matching becomes manual. Duplicates are preserved with warnings but same recipient-document revision must not be sent twice due a repeated operation. Unknown send outcomes must be reconciled, not blindly retried. Use scoped signed R2 URLs and keep all provider secrets out of the browser.

## Round 8 — hosting, provider choice, retention start, preview fidelity

### Exact user answers

1. Hosting/$0: **private-prototype**.
2. Cookie topology: **same-origin**.
3. Email provider: **compare-providers**.
4. Re-import without stable key: **manual-uncertain**.
5. Retention start: **completion-deadline**.
6. Preview: **same-pipeline**.
7. Workload limit: **benchmark-before-promise**.
8. Additional notes: **none**.

### Reasoning recorded

Vercel Hobby personal/non-commercial restriction is a public launch blocker. R2/Mongo deletion is asynchronous. Quota may be much slower than retention. Use the same PDF transformation path for previews/final output. Do not advertise the 5,000 row cap until benchmarks pass.

## Round 9 — final implementation defaults and email request

### Exact user answers

1. Output expiry vs pending email: **strict-deadline**.
2. First email-provider prototype: **downloads-first**.
3. Physical deletion under zero-cost: **daily-sweep**.
4. API contract between separate repos: **openapi**.
5. Dev tooling: **recommended-stack** (Node LTS, npm/lockfiles, Vitest, Playwright, GitHub Actions).
6. Additional request: **“I want you to use nodemailer or something so that we can send more emails at a time.”**

### Reasoning recorded

Nodemailer can pool SMTP connections/avoid per-message connection setup, but it is not an email provider and cannot increase a provider’s actual quota. Brevo's batch API can lower API request overhead but the documented per-message-version override schema does not explicitly establish a unique attachment for each message version. The unique-PDF-per-recipient requirement must be tested; otherwise use individual messages at controlled concurrency. Downloads-first remains the first prototype decision.

## Recurrent user instructions throughout discovery

The user repeatedly requested critical analysis against all prior answers; research of current provider/technical constraints; preservation of all earlier requirements; explicit separation of decisions, recommendations and assumptions; versioned decision-log updates; and continued interview questions without repeating decisions already answered. The user wants all later PRD, development, promotion, presentation and ideation based on complete project documentation.


---

<!-- Source file: 05_PRODUCT_REQUIREMENTS_AND_WORKFLOWS.md -->

# Product Requirements and Workflows

## 1. Product direction

Build a web application that lets people upload an existing text-based PDF, import recipient or record data from CSV/XLSX, map data fields to placeholders or visual regions, review personalized draft documents, generate a batch of individual PDFs, download them as a ZIP, and optionally send each PDF to its intended recipient. The longer-term vision includes lightweight visual PDF editing and additional workflow features.

The product is intended to work across document categories rather than being limited to certificates. Likely document types include event certificates, education/training documents, letters, invitations, acknowledgements, notices, and business documents. The initial technical scope remains intentionally narrower than “any PDF”: text-based PDFs with automatic field suggestions and explicit visual confirmation.

### Product hypothesis

The product will be differentiated by a low-friction existing-PDF workflow, clear review and validation, reliable per-recipient processing, transparent delivery states, and recoverability when some rows or emails fail. CSV/XLSX support, free usage, and bulk generation alone are not sufficient differentiation.

## 2. Confirmed decisions from discovery

| Area | Current decision | Notes / implications |
|---|---|---|
| Audience | General-purpose users | Generality is the long-term vision; a narrower first-market segment still needs validation. |
| Launch scope | All document categories from launch | Categories can be flexible while PDF compatibility remains constrained and documented. |
| Initial PDF support | Text-based PDFs with automatic field suggestions | Scanned/image-only PDFs and arbitrary-layout OCR are not committed for MVP. |
| Field placement | Detect tokens and use confirmed visual overlays | Overlay-based masking must be safe; clean placeholder areas are required when the background cannot be reconstructed reliably. |
| User interaction | Mostly automatic detection with explicit confirmation | Confidence, fallback, visual preview, and safe failure behavior need specification. |
| Variable field types | Text, dates, and numbers | Image fields, personalized photos, signatures, IDs, and QR codes are future possibilities, not MVP commitments. |
| Data import | CSV and XLSX with column mapping | Validation and column matching are necessary. Copy/paste and Google Sheets integration have not been decided. |
| Target batch size | 500–5,000 recipients initially | Performance testing must include the upper end and account for PDF size and email quotas. |
| Draft review | Users can browse every draft before final approval | A paginated/searchable gallery and on-demand previews should avoid generating and persisting all full PDFs before approval. |
| Invalid rows | Block only affected rows and process valid rows | The UI needs row-level validation, errors, and a correction/retry path. Delivery may be unavailable for rows without valid email addresses. |
| Delivery | App-managed email with one PDF attachment per recipient | Email provider and sending quotas remain undecided. Sending through a connected organizer mailbox is deferred. |
| Sending behavior | Automatically throttle; retry transient failures; expose permanent failures | Need per-recipient states, bounded retries, provider webhooks/events, and duplicate-send safeguards. |
| Sender identity | Organizer mailbox integration later | Initial sending is app-managed; branding and custom-domain sending policy remain open. |
| Downloads | ZIP of individual PDFs plus optional individual downloads | ZIP creation should stream or operate from object storage rather than requiring all output in application memory. |
| Accounts | Individual user accounts | Team workspaces and shared organization permissions are not MVP commitments. Design ownership fields so teams can be added later. |
| Reusable templates | Accounts with reusable templates and temporary job history | A saved template retains its original PDF until the user deletes the template. |
| Retention | User-configurable deletion | Job inputs/outputs are governed separately from saved template source files. Exact options, minimum/maximum retention, and deletion guarantees remain open. |
| Batch controls | Pause, resume, and cancel unsent work | Completed generation/sends remain recorded; cancellation cannot unsend already accepted email. |
| First extension priority | Delivery tracking and automatic retries | This is core reliability work, not merely cosmetic post-MVP polish. |
| Business model | Completely free initially; monetization may be considered later | Must not promise unlimited email or compute on third-party free plans. |
| Future direction | Lightweight visual PDF editor and broader customization | Do not build a Canva-scale editor before validating need. |
| Preferred technology | TypeScript, Node.js, MongoDB, related JS ecosystem | Exact frontend framework, server framework, job queue, storage and email provider remain open. |

## 3. Critical analysis and risks

### 3.1 “Any document category” is not the same as “any PDF”

A common processing engine can support many document use cases, but the application should publish a compatibility boundary. Text-based PDFs can still have fragmented text, embedded fonts, rotated content, complicated layouts, multiple pages, or placeholders printed over non-uniform backgrounds. A detected token does not mean the old glyphs can be edited out safely.

**MVP rule:** support recognized placeholders and user-confirmed visual fields in text-based PDFs. If the placeholder cannot be hidden without damaging content, require a clean field region or manual masking confirmation; reject unsupported layouts clearly rather than silently producing bad files.

### 3.2 PDF libraries are complementary, not interchangeable

PDF.js can be used for rendering and text extraction/position inspection. `pdf-lib` can modify PDF structure, draw text/images, embed fonts, and work with form fields. Its published limitations state that it does not provide APIs to extract ordinary page text or remove/edit text drawn on a page outside a form field. Therefore, do not design the MVP around universal in-place text replacement through `pdf-lib` alone.

A practical first pipeline is:
1. Render and inspect the PDF.
2. Extract searchable text and candidate token positions with PDF.js.
3. Suggest field mappings and ask the user to confirm them.
4. Render a safe mask over the original placeholder region where possible.
5. Draw the replacement value using selected fonts and alignment rules.
6. Render proof previews and perform visual regression checks on supported templates.

### 3.3 Review every draft without needless full-document generation

The explicit requirement to browse every draft is important, but requiring thousands of full final PDFs to be stored before approval would waste resources. Use a review gallery with pagination, search, document-level preview, and anomaly highlighting (e.g. missing values, unusually long text, likely overflow). Render previews on demand when possible. Before final approval, preserve a versioned snapshot of the dataset and mappings. After approval, generate final PDFs from that immutable snapshot.

A future interview question must decide whether users can edit individual record values in the gallery or must correct the spreadsheet and re-import. This affects auditability and complexity.

### 3.4 Reliability is more than retries

BullMQ supports retry/backoff and rate limiting, but retrying an email send can produce duplicate delivery if the provider accepted the message and the worker crashed before saving the result. Email does not generally offer end-to-end exactly-once delivery as an application-level guarantee.

Use small, separately tracked jobs and idempotent state transitions. Record a recipient delivery intent before send; use provider message IDs, webhooks/events where available, and an explicit `unknown/pending reconciliation` case when send outcome is ambiguous. Never automatically retry permanent recipient failures or invalid content indefinitely.

### 3.5 Free infrastructure is an MVP strategy, not a reliability guarantee

Render's free web services sleep after 15 minutes without inbound traffic, may restart at any time, and have ephemeral filesystems. Its free Key Value instances are in-memory and lose data on restart. Render documents free services as intended for exploration/testing rather than production, and free web services cannot send outbound traffic on SMTP ports 25, 465, or 587. An API-based email provider may still work, but background processing and durable queue behavior need separate investigation.

Potential discovery-stage candidates include MongoDB Atlas Free for small metadata volumes, Upstash Redis for a modest BullMQ prototype, and Cloudflare R2 or another S3-compatible object store for PDFs. Each provider's current terms, limits, regions, data residency, quotas and production suitability must be confirmed before commitment. No free tier should be treated as a guaranteed production SLA.

### 3.6 Retention needs more than a MongoDB TTL index

MongoDB TTL indexes remove eligible documents asynchronously and do not guarantee immediate deletion. Binary files held in object storage need their own deletion process/lifecycle policy. The user-facing guarantee should define a deadline and the application should track cleanup outcomes. For deletion requests, revoke access immediately where possible and perform asynchronous physical deletion with retry and audit of the cleanup operation.

Saved template configuration and source PDF should be retained until the user deletes the template. Recipient spreadsheets, generated PDFs and detailed recipient-level records should follow separate configurable expiry rules. Define whether aggregates without personal data survive expiry.

### 3.7 Attachment limits affect the experience

Email providers and recipient systems enforce message-size limits; attachment encoding increases the wire size. Large attachments may bounce or be rejected by recipient mail systems even if the sending provider accepts them. The application should enforce per-file and estimated message-size limits, clearly surface non-sendable rows, and eventually consider secure expiring links as an alternative. The current product decision is individual PDF attachments, so links remain an option for later, not an assumed default.

## 4. Preliminary user workflow

1. User signs in and creates a job or selects a reusable template.
2. User uploads the PDF if creating a new template; uploads CSV/XLSX data.
3. System validates file type, size, schema, row count, and parseability.
4. System extracts text and proposes placeholder matches or candidate field locations.
5. User maps fields to spreadsheet columns and confirms field coordinates, font, size, alignment, and supported mask behavior.
6. System validates rows independently, identifies duplicate/missing values, invalid email addresses (if sending), and potential overflow.
7. User browses the drafts via a searchable, paginated review gallery. Each record can be previewed; likely problems are highlighted.
8. User approves a versioned dataset + mapping snapshot.
9. Generation workers create individualized PDFs and update row/document status independently.
10. System creates a ZIP archive and allows individual downloads.
11. If email delivery is enabled, delivery jobs send one attachment per valid recipient while respecting provider quotas.
12. Provider delivery/bounce events update statuses when available; transient failures retry with bounded backoff; permanent failures are shown with actionable reasons.
13. User can pause, resume, or cancel pending work. Completed actions are retained in job history until the applicable retention deadline.
14. A scheduled cleanup process deletes temporary inputs/outputs and associated personal data according to the user's retention setting, while reusable template files persist until the template is deleted.

## 5. Open questions to resolve in later interview rounds

### Product and workflow
- Which initial audience should be recruited first for user interviews despite the general-purpose long-term vision?
- Can users correct one recipient directly in the review gallery, or must they edit/re-import source data?
- What exact actions are allowed once any emails have been sent?
- Should generated ZIPs include a manifest/CSV mapping recipient to file and status?
- Do users need an event/session ID, certificate number, or public verification at launch? (Not committed.)
- Should recipients be allowed to download their own document without an account? (Not committed.)

### Performance and limits
- Exact maximum upload bytes, page count, rows per job, fields per page, and maximum output size.
- Target time to first preview and expected processing throughput on chosen free/low-cost instances.
- Concurrent job count and fairness between users.
- How long generation results, logs, recipient rows and delivery outcomes remain available.

### Authentication and account lifecycle
- Email/password, passkeys, OAuth, or combination; verification and recovery mechanism.
- Whether email address is required for a user account even for download-only jobs.
- Rate limits, abuse controls, account deletion, and whether users can export/delete their data.

### Technical/deployment
- Frontend and API framework choice.
- MongoDB hosting and backup strategy.
- Object storage provider and lifecycle/deletion behavior.
- Redis/BullMQ deployment and persistence; whether a managed queue alternative is safer for early hosting.
- Email provider, free quotas, production approval requirements, webhooks, domain verification, unsubscribe/suppression policies and error taxonomy.
- Whether a separate worker can run reliably on chosen free hosting.
- Logging/metrics/alerts and a recovery procedure for stuck jobs.

### Business and validation
- Initial acquisition channel and early adopter group.
- Product analytics that respect data minimization.
- What metrics define success: completed jobs, documents generated, delivery success, time saved, repeat use, or conversion.
- What paid capability—if any—could eventually fund variable email/storage/compute costs.


---

<!-- Source file: 06_PDF_ENGINE_AND_RENDERING_SPEC.md -->

# PDF Engine and Rendering Specification

## Product requirement

The user uploads an existing PDF, imports structured records, maps placeholders/regions, and generates individualized documents. Preserve the source design as far as the supported PDF model allows. The app should not require users to recreate the entire document in a proprietary editor.

## Fundamental constraint

A PDF is primarily a rendering description, not necessarily a semantic/editable document. Text can be fragmented into multiple drawing operations, use embedded/subset fonts, be outlined as vectors or be baked into images. Detecting a placeholder does not mean the old text can be safely removed. The `pdf-lib` project documentation says it can manipulate PDF form fields and draw content, but does not provide general APIs to extract ordinary page text or remove/edit page-drawn text outside a form field. PDF.js helps render and extract searchable text positions; it does not make every file an editable layout model.

## Selected MVP scope

- Text-based PDFs with automatic field suggestions.
- Standardized token recognition where possible (examples: `{{name}}`, `{{date}}`, `{{organization}}`).
- Visual field mapping and user confirmation when token detection is absent or uncertain.
- User-confirmed overlays/masking rather than a promise of in-place arbitrary text replacement.
- Clean placeholder areas required when a background cannot be safely reconstructed.
- Text, dates and numbers as initial variable types.
- Capped multi-page support; exact page cap established through benchmarks.
- Scanned/image-only PDF OCR is not committed.
- Universal arbitrary PDF compatibility is not committed.

## Candidate pipeline

1. Load/render the source PDF in the browser using PDF.js.
2. Extract searchable text and candidate token positions; detection is a suggestion, not authority.
3. Suggest mapped field boxes and allow the user to confirm/correct them.
4. Associate PDF fields with CSV/XLSX column definitions and per-field formatting.
5. If replacing visible placeholder text, let the user confirm a mask region. Do not blindly paint a white block over patterned/illustrated artwork.
6. Draw the replacement with pdf-lib, embedding fonts where permitted and applying alignment, color, size and fitting rules.
7. Create preview output through the same transformation pipeline as final output. Render the resulting PDF preview via PDF.js to minimize drift.
8. Display missing-value, unsupported layout and overflow warnings; do not silently clip or misplace content.
9. Allow the user to browse every draft from a paginated/searchable gallery. Generate/render the full output preview on demand to control memory/storage.
10. After final approval, process an immutable snapshot in bounded Web Worker chunks. Upload completed outputs and persist checkpoints; resume after the user returns.

## Fit-then-flag behavior

The user selected “fit-then-flag.” Proposed implementation:
- Compute available space from the configured field box.
- Shrink only inside explicit minimum/maximum font-size bounds.
- If a value still does not fit, flag the affected document/field and require correction or explicit override.
- Do not silently clip, overlap nearby content or shrink to unreadable size.
- Wrapping may be added as a per-field option, but the user has not independently selected a wrapping policy.

## Preview and draft gallery

The same PDF transformation pipeline should produce preview and final output to minimize differences in font metrics/masking. The gallery should support pagination, search, row-level warnings, document preview and individual inspection of all drafts before approval. Full final PDFs need not all be permanently stored before approval, but every draft must be browseable.

## Browser execution and limits

PDF work is browser-side; Web Workers should keep the UI responsive. The browser cannot continue processing after it is closed/suspended. The selected model is pause/resume on return. Browser memory is finite, so output buffers and ZIP creation must be bounded/streamed where possible, and large batches may need multiple ZIP archives.

## Required fixture tests

- Standard searchable text PDF and explicit token.
- Token split across text fragments.
- Embedded/subset fonts and Unicode names.
- Long and unusually short names.
- Rotated text or pages.
- Multi-page layout with fields on multiple pages.
- Date and numeric formatting.
- Patterned background and unsafe mask area.
- Empty/missing placeholder or missing data field.
- Malformed/corrupted PDF.
- Encrypted/password PDF (reject clearly if not supported).
- Oversized page/file or too-many-pages file.
- Font cannot be embedded or unsupported text encoding.
- Preview/final render consistency.

## Benchmark-before-promise

No final max bytes/pages/rows/fields/output size, concurrent jobs or completion time has been selected. Test 500, 1,000 and 5,000 records on representative templates and browsers/devices. Measure time to first preview, worker/UI responsiveness, peak memory, error rate, object upload rate, ZIP memory and resume behavior. Advertise only limits that pass the chosen fixture/benchmark matrix.

## References

- PDF.js: https://github.com/mozilla/pdf.js
- PDF.js API: https://mozilla.github.io/pdf.js/api/
- pdf-lib: https://github.com/Hopding/pdf-lib
- JSZip: https://stuk.github.io/jszip/documentation/api_jszip/generate_async.html


---

<!-- Source file: 07_SYSTEM_ARCHITECTURE.md -->

# System Architecture

**Status:** Architecture direction selected; several production execution and hosting constraints remain unresolved. This file supersedes older architecture descriptions where they conflict with the current decision register.

## 1. User-confirmed architecture decisions

- Frontend: React + Vite + TypeScript.
- Backend direction: Hono + TypeScript on Vercel for a **private prototype**.
- Source layout: separate web and API repositories.
- Authentication: Google Identity Services only, verified server-side.
- Application session: HttpOnly cookie, with same-origin browser/API topology.
- PDF rendering, field mapping, preview and final PDF generation: browser-side, using bounded Web Worker chunks where appropriate.
- Durable application metadata/state: MongoDB.
- Queue direction: MongoDB-backed queue/claim records. This does not execute itself; the active dispatcher is browser-driven in the prototype.
- Object storage: Cloudflare R2, private by default.
- Validation: Zod.
- API contract between repositories: OpenAPI.
- Progress: polling against persisted state.
- Email: not enabled in the first prototype (downloads-first); email can later be initiated by the frontend but provider secrets and the actual authorized send call remain server-side in Hono.
- Browser closure pauses browser-run processing; users can resume when they reopen the application.
- Strict $0 infrastructure budget is an explicit user constraint.

## 2. Candidate logical architecture

```text
React/Vite application (web repository)
  ├─ Google Identity Services sign-in
  ├─ PDF.js rendering / inspection / visual field mapping
  ├─ CSV/XLSX parsing and column mapping
  ├─ searchable draft gallery
  ├─ Web Worker: bounded PDF generation chunks
  ├─ bounded ZIP generation / split archives if needed
  └─ progress polling and resume
       │ same-origin /api; secure session cookie
       ▼
Hono API on Vercel (API repository; private prototype only)
  ├─ verify Google ID token / create application session
  ├─ authorize ownership on every operation
  ├─ Zod validation
  ├─ MongoDB job/template/row/attempt state
  ├─ create scoped R2 upload/download URLs
  ├─ accept validated checkpoints
  ├─ future: email-provider adapter, webhook verification, quota enforcement
  └─ cleanup endpoint/orchestrator where compatible with the chosen free plan
       │                           │
       ▼                           ▼
MongoDB Atlas                    Cloudflare R2
users/templates/jobs             private source/template PDFs
rows/snapshots/status            per-recipient outputs / archives
attempts/cleanup ledger          expiration lifecycle + direct deletion
```

This architecture is a logical map, not a claim that every process runs continuously on free infrastructure. In the private prototype, CPU-intensive PDF work pauses when the browser closes. The MongoDB queue state must be advanced by an active dispatcher; a record alone does not execute work.

## 3. Boundaries and data movement

1. The browser authenticates with Google, obtains a Google ID token and sends it to Hono for verification.
2. Hono establishes an application session in a cookie protected for the actual same-origin deployment topology. Google token verification and app session are distinct mechanisms.
3. Hono issues short-lived, scoped R2 upload URLs. The browser uploads files directly to R2 rather than proxying large binaries/base64 through Vercel Functions.
4. Hono stores metadata and state in MongoDB. Binary PDF/ZIP data normally belongs in R2, not regular MongoDB documents.
5. PDF.js is used for render/inspection/coordinates. `pdf-lib` is used to draw/overlay personalized content and work with supported form fields; generic existing page text is not universally editable in-place.
6. The user inspects drafts using the same PDF processing pipeline used for final output; only after final approval is an immutable snapshot accepted.
7. The browser processes bounded chunks and sends completion/checkpoint metadata to Hono. Deterministic artifact keys, checksums and unique operation identifiers make repeated operations safe.
8. Download URLs are short-lived and scoped. ZIP download generation is benchmarked and bounded; large archives may require splitting.
9. Email (future phase) is initiated/orchestrated by browser chunks, but Hono makes provider calls with server-side secrets. If the browser goes away, delivery pauses unless an independent worker or scheduler is introduced later.
10. Cleanup is recorded in MongoDB and deletes R2 objects through a daily sweep; R2 lifecycle rules are a backstop, not a guarantee of instantaneous erasure.

## 4. Confirmed direction versus unapproved implementation details

### Confirmed by user

All nine architecture decisions listed in Section 1 and the follow-on Hono clarification.

### Recommended, not user-approved as exact implementation choices

- Repository names `bulk-document-web` and `bulk-document-api`.
- Exact MongoDB collections, indexes, API paths and status enum strings.
- Exact browser chunk size/concurrency, per-file/page limits, supported font policy and throughput targets.
- Exact OpenAPI generation tooling.
- Whether cleanup uses Vercel Cron, an external scheduler, or another allowed mechanism.
- Exact email provider / Nodemailer transport arrangement.
- Exact production hosting and whether a strict $0 solution exists under the provider's terms.

## 5. Hosting and zero-cost feasibility

Vercel Hobby was selected only for a private personal/non-commercial prototype because its current terms restrict Hobby use to personal/non-commercial use. Public service eligibility is unresolved and must be rechecked against current terms. The strict $0 budget is not permission to assume another provider will offer persistent, always-on workers for free.

Vercel Functions have request/response payload limits (the research snapshot recorded a 4.5 MB limit), so direct R2 upload/download is the design direction. Any future public deployment must pass a check of applicable provider terms, function duration, scheduler frequency, network constraints, storage pricing and service availability.

## 6. Queue/execution interpretation

The user's selected “MongoDB queue” is interpreted as durable queue/claim/lease records stored in MongoDB, not a queue implementation that automatically executes. The selected prototype execution model is browser-driven and resumable:

- Browser dispatcher claims a small amount of work.
- Claims use an atomic predicate/update, lease/expiry and unique operation key.
- Browser reports completion/checkpoint state through Hono.
- Stale claims are reclaimable only after their lease expires.
- On browser closure, active CPU work stops; on return, the app reloads server-persisted job state and resumes.
- Email does not begin in the first prototype.
- If later requirements demand unattended delivery after tab closure, a genuine independently scheduled worker is needed; that is a new architecture/budget decision.

## 7. Architecture risks

- Public launch host compatible with strict $0 budget: unresolved.
- Browser memory/performance for multi-page PDFs and 5,000 records: must benchmark.
- Same-origin cookie deployment across separately maintained repositories: must test.
- R2 free allowance is limited, and overage must be prevented to preserve strict zero budget.
- MongoDB Atlas Free capacity/index costs and connection/concurrency limits: test.
- R2 object deletion is asynchronous; daily sweep can fail; make deletion visible and retryable.
- A browser-held dispatcher is not an always-on background worker.
- Email provider quota remains a business/UX constraint; Node concurrency or Nodemailer pooling does not increase upstream allowances.

## 8. Reference links

- Hono on Vercel: https://vercel.com/docs/frameworks/backend/hono
- Vercel terms: https://vercel.com/legal/terms
- Vercel Function limitations: https://vercel.com/docs/functions/limitations
- Google Identity token verification: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
- PDF.js: https://github.com/mozilla/pdf.js
- pdf-lib: https://github.com/Hopding/pdf-lib
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- R2 object lifecycles: https://developers.cloudflare.com/r2/buckets/object-lifecycles/
- MongoDB TTL indexes: https://www.mongodb.com/docs/v8.0/core/index-ttl/


---

<!-- Source file: 08_DATA_MODEL_API_AND_STATE_MACHINES.md -->

# Data Model, API and State Machines

## 18. Proposed data model (implementation draft; requires review)

The schema intentionally keeps large binary data out of MongoDB and separates mutable draft data from immutable approved recipient snapshots. Exact field naming can evolve, but the invariants should not.

### 18.1 Collections and key fields

#### `users`

```ts
{
  _id: ObjectId;
  googleSub: string;               // verified Google `sub`, unique identity key
  email: string;
  emailVerified: boolean;
  displayName?: string;
  status: "active" | "suspended" | "deletion_pending";
  createdAt: Date;
  updatedAt: Date;
  limits: { maxRowsPerBatch: number; maxActiveBatches: number; emailQuota: number };
}
```

Never use email as the provider identity key. Google documents the `sub` claim as the stable, unique identifier; verify signature, audience, issuer and expiry server-side.

#### `templates`

```ts
{
  _id: ObjectId;
  ownerId: ObjectId;
  name: string;
  currentVersionId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  retention: { sourcePdfRetainedUntilDeleted: true };
}
```

#### `templateVersions`

```ts
{
  _id: ObjectId;
  templateId: ObjectId;
  ownerId: ObjectId;
  version: number;
  sourceObjectKey: string;         // opaque, server-generated R2 key
  sourceSha256: string;
  sourceBytes: number;
  pageCount: number;
  pdfCompatibility: "supported" | "warning" | "unsupported";
  fieldMappings: Array<{
    fieldKey: string; label: string; type: "text" | "date" | "number";
    pageIndex: number; x: number; y: number; width: number; height: number;
    align: "left" | "center" | "right"; fontFamily?: string;
    minFontSize?: number; maxFontSize?: number;
    fitMode: "shrink-then-flag" | "wrap-then-flag" | "strict";
    mask: { mode: "none" | "solid-fill"; color?: string };
  }>;
  createdAt: Date;
  createdBy: ObjectId;
  status: "draft" | "active" | "superseded";
}
```

Mappings are versioned. Do not mutate a template version referenced by an approved batch. Coordinate units and the conversion from PDF.js viewport coordinates to PDF page coordinates must be defined once and tested against page rotation and scale.

#### `batches`

```ts
{
  _id: ObjectId;
  ownerId: ObjectId;
  templateId: ObjectId;
  name: string;
  lifecycle: "draft" | "importing" | "review" | "approved" | "active" |
             "paused" | "canceling" | "canceled" | "completed" |
             "partial" | "failed" | "expiring" | "expired";
  currentImportRevision: number;
  approvedSnapshotId?: ObjectId;
  generation: { status: GenerationStatus; total: number; pending: number;
                processing: number; generated: number; failed: number };
  delivery: { status: DeliveryStatus; eligible: number; queued: number;
              attempting: number; accepted: number; delivered: number;
              bounced: number; complained: number; failed: number; unknown: number };
  flags: { pauseRequested: boolean; cancelRequested: boolean };
  retention: { presetHours: 24 | 168 | 720; expiresAt?: Date };
  createdAt: Date;
  updatedAt: Date;
  version: number;                  // compare-and-set / optimistic concurrency
}
```

Counters are an eventually consistent summary for fast UI polling, not the only source of truth. A reconciliation routine must be able to recompute them from rows/work items.

#### `batchImports`

```ts
{
  _id: ObjectId;
  batchId: ObjectId;
  ownerId: ObjectId;
  revision: number;
  status: "uploading" | "parsing" | "validating" | "ready" | "rejected" | "superseded";
  rowCountExpected?: number;
  rowCountReceived: number;
  columnMap: Record<string, string>; // target field -> imported column name
  reconciliationKey?: string;
  counts: { valid: number; invalid: number; duplicateWarnings: number; conflicts: number };
  createdAt: Date;
  completedAt?: Date;
}
```

#### `draftRows`

```ts
{
  _id: ObjectId;
  batchId: ObjectId;
  importId: ObjectId;
  ownerId: ObjectId;
  rowKey: string;                    // stable only within this import revision
  sourceRowNumber: number;
  naturalKey?: string;
  importedData: Record<string, string | number | null>;
  overrides: Record<string, string | number | null>;
  effectiveData: Record<string, string | number | null>;
  validationErrors: Array<{ field?: string; code: string; message: string }>;
  duplicateWarnings: Array<{ code: string; relatedRowKey?: string }>;
  editedAt?: Date;
  updatedAt: Date;
}
```

`effectiveData` should be a derived/canonical value after validating `importedData + overrides`; do not let the client send arbitrary “valid” flags. Revalidate server-side on every edit, import chunk and approval request.

#### `approvedSnapshots`

```ts
{
  _id: ObjectId;
  batchId: ObjectId;
  ownerId: ObjectId;
  snapshotRevision: number;
  templateVersionId: ObjectId;
  templateSourceSha256: string;
  mappingSha256: string;
  rowCount: number;
  snapshotDigest: string;             // digest of a canonical ordered representation
  state: "building" | "ready" | "failed" | "superseded";
  approvedAt?: Date;
  createdAt: Date;
}
```

#### `approvedRecipients`

```ts
{
  _id: ObjectId;
  batchId: ObjectId;
  snapshotId: ObjectId;
  ownerId: ObjectId;
  recipientKey: string;
  sourceRowNumber: number;
  dataSnapshot: Record<string, string | number | null>; // immutable
  emailNormalized?: string;
  generationStatus: "pending" | "leased" | "generated" | "failed" | "skipped";
  generationAttempts: number;
  generationLease?: { owner: string; expiresAt: Date };
  outputObjectKey?: string;
  outputSha256?: string;
  outputBytes?: number;
  deliveryStatus: "not_requested" | "queued" | "leased" | "retry_wait" | "accepted" |
                  "delivered" | "bounced" | "complained" | "failed_permanent" |
                  "unknown" | "paused" | "canceled";
  deliveryAttempts: number;
  nextAttemptAt?: Date;
  providerMessageId?: string;
  lastErrorCode?: string;
  lastErrorSafeMessage?: string;
  updatedAt: Date;
}
```

Keep name/address/email data separate from long-term aggregate history and delete it on expiry. Do not log `dataSnapshot`, source text, email content, signed URLs, tokens, or provider secrets.

#### `workItems`

```ts
{
  _id: ObjectId;
  ownerId: ObjectId;
  batchId: ObjectId;
  snapshotId: ObjectId;
  recipientId: ObjectId;
  phase: "generate" | "send" | "cleanup";
  operationKey: string;               // deterministic logical operation key
  status: "queued" | "leased" | "retry_wait" | "completed" | "dead" | "canceled";
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  leaseOwner?: string;
  leaseExpiresAt?: Date;
  lastErrorCode?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

For this architecture, `workItems` is a persisted lease/dispatch ledger driven in chunks by an active browser, not a claim of autonomous execution when no browser is active. Unique `operationKey` prevents duplicate logical work creation. The approved recipient row remains authoritative for final state.

#### `deliveryAttempts`

```ts
{
  _id: ObjectId;
  ownerId: ObjectId;
  batchId: ObjectId;
  snapshotId: ObjectId;
  recipientId: ObjectId;
  attemptNumber: number;
  appIdempotencyKey: string;          // durable for the app's retention period
  providerIdempotencyKey?: string;    // provider window/behavior may be limited
  providerMessageId?: string;
  status: "started" | "accepted" | "known_transient_failure" |
          "known_permanent_failure" | "unknown" | "reconciled";
  startedAt: Date;
  finishedAt?: Date;
  errorCode?: string;
}
```

#### `providerEvents`

```ts
{
  _id: ObjectId;
  provider: string;
  providerEventId: string;
  providerMessageId?: string;
  recipientId?: ObjectId;
  normalizedType: string;
  receivedAt: Date;
  processedAt?: Date;
  minimalPayload: Record<string, unknown>; // allowlisted fields only
}
```

Verify webhook signature before accepting events. Use a unique `(provider, providerEventId)` index. Events may be duplicate or out of order; derive state using transition rules, not last-write-wins blindly.

#### `cleanupTasks` and `auditEvents`

`cleanupTasks` contains an opaque object key, related owner/template/batch IDs, `dueAt`, attempt count, status, lease, and last error code. It is required because MongoDB TTL does not delete R2 objects. `auditEvents` records security-meaningful actions with actor, resource ID, action and timestamp; never copy full PII or signed URLs into the event.

### 18.2 Index plan

Create indexes through explicit migrations/startup checks rather than waiting for production queries to fail:

- `users`: unique `{ googleSub: 1 }`; optionally normalized email index for account lookup (not identity).
- `templates`: `{ ownerId: 1, updatedAt: -1 }`; `{ ownerId: 1, deletedAt: 1 }` for active-template listing.
- `templateVersions`: unique `{ templateId: 1, version: 1 }`; `{ ownerId: 1, templateId: 1, createdAt: -1 }`.
- `batches`: `{ ownerId: 1, updatedAt: -1 }`; `{ lifecycle: 1, updatedAt: 1 }` only if needed for operational queries.
- `batchImports`: unique `{ batchId: 1, revision: 1 }`.
- `draftRows`: unique `{ importId: 1, rowKey: 1 }`; `{ batchId: 1, importId: 1, sourceRowNumber: 1 }`; index selected reconciliation key only as a normal/non-unique index unless uniqueness is validated.
- `approvedSnapshots`: unique `{ batchId: 1, snapshotRevision: 1 }`; `{ state: 1, createdAt: 1 }` for recovery.
- `approvedRecipients`: unique `{ snapshotId: 1, recipientKey: 1 }`; `{ batchId: 1, snapshotId: 1, generationStatus: 1, sourceRowNumber: 1 }`; `{ batchId: 1, snapshotId: 1, deliveryStatus: 1, nextAttemptAt: 1 }`.
- `workItems`: unique `{ operationKey: 1 }`; `{ status: 1, availableAt: 1, leaseExpiresAt: 1, phase: 1 }`; `{ batchId: 1, snapshotId: 1, phase: 1, status: 1 }`.
- `deliveryAttempts`: unique `{ appIdempotencyKey: 1 }`; `{ recipientId: 1, attemptNumber: 1 }`; sparse index `{ providerMessageId: 1 }` where supported.
- `providerEvents`: unique `{ provider: 1, providerEventId: 1 }`; `{ providerMessageId: 1 }`.
- `cleanupTasks`: `{ status: 1, dueAt: 1, leaseExpiresAt: 1 }`; unique cleanup operation key to keep deletion idempotent.

Avoid a unique index on email per batch. Multiple rows may legitimately use the same email. Test the actual Atlas Free feature/index/storage limits before choosing the final index set.

## 19. Proposed Hono API contract

All routes are versioned under `/api/v1`. Responses use consistent error bodies such as `{ error: { code, message, requestId, retryable? } }`. User-facing messages must not disclose provider secrets or internal exception strings. Zod validates every external body, query, route param, and critical worker payload.

### 19.1 Authentication and account

- `POST /api/v1/auth/google/session` — accepts a Google credential, validates token signature/audience/issuer/expiry, validates request origin/CSRF protections appropriate to the GIS mode, resolves user by Google `sub`, and sets the app session cookie.
- `POST /api/v1/auth/logout` — revoke/expire server session and clear cookie.
- `GET /api/v1/me` — return minimal user profile and capability/quota summary.

Use an opaque, random session ID stored server-side if practical, or a signed session with rotation/revocation semantics. Cookie attributes should include `HttpOnly`, `Secure` in production, a deliberate `SameSite` setting, path scoping, and no unnecessary domain widening. Credentialed CORS must allow only known origins. A cross-site front end/API deployment can break cookie behavior; deployment topology is still an open decision.

### 19.2 Template lifecycle and upload

- `POST /api/v1/templates` — create draft template metadata; returns template ID and an upload intent.
- `POST /api/v1/uploads/presign` — accepts only an enumerated purpose and owned resource; Hono creates a random opaque object key and returns a short-lived R2 PUT URL. Client cannot choose arbitrary buckets/keys.
- `POST /api/v1/templates/:templateId/source/complete` — verify ownership, object existence, byte limit, expected type, checksum where available and supported PDF signature; record an immutable template version.
- `GET /api/v1/templates` and `GET /api/v1/templates/:templateId` — return metadata only; issue separate short-lived GET URL when the browser needs the source PDF.
- `PATCH /api/v1/templates/:templateId` — create a new immutable template version for mapping/style changes; don't mutate versions referenced by approved snapshots.
- `DELETE /api/v1/templates/:templateId` — soft-delete metadata and enqueue source/version object cleanup; deletion completion is a separate status.

### 19.3 Batch/import/review/approval

- `POST /api/v1/batches` — create draft batch linked to an explicit template version.
- `POST /api/v1/batches/:batchId/imports` — create an import revision and define column mapping/reconciliation key.
- `POST /api/v1/batches/:batchId/imports/:importId/rows` — ingest a bounded JSON chunk of parsed rows; server-side Zod validates and canonicalizes each record. Each response gives accepted/invalid row counts and row-level codes. Keep each request comfortably below Vercel's 4.5 MB payload cap.
- `POST /api/v1/batches/:batchId/imports/:importId/complete` — finalize expected row count; mark revision `ready` only when all chunks are accounted for and validation is complete.
- `GET /api/v1/batches/:batchId/review` — paginated/searchable rows, validation warnings, draft preview metadata and diff summary.
- `PATCH /api/v1/batches/:batchId/rows/:rowId` — apply a draft-only field override; revalidate the row and record a minimal audit entry.
- `POST /api/v1/batches/:batchId/reimports/:importId/compare` — produce a proposed diff (added/removed/changed/duplicates/conflicts) without mutating the current draft.
- `POST /api/v1/batches/:batchId/reimports/:importId/apply` — apply the confirmed reconciliation in a new draft revision. Existing approved revisions remain untouched.
- `POST /api/v1/batches/:batchId/approve` — server verifies no unresolved blocking errors, stores/finalizes an immutable approved snapshot, and uses a compare-and-set transition so two simultaneous approvals cannot create competing active snapshots.
- `GET /api/v1/batches/:batchId` and `GET /api/v1/batches/:batchId/progress` — return persisted state and aggregate counters, never all PII unless requested for a paginated authorized view.

### 19.4 Browser generation and output upload

- `POST /api/v1/batches/:batchId/generation/claim` — atomically claim a small set of eligible recipient rows with a browser-run ID and lease expiry; return approved data and a short-lived template GET URL.
- `POST /api/v1/batches/:batchId/recipients/:recipientId/output-upload-intent` — confirm that recipient is claimed and authorized, then return a single-object R2 PUT URL and server-generated output key.
- Browser Worker generates the PDF, uploads it directly to R2, and computes a SHA-256/checksum and byte size.
- `POST /api/v1/batches/:batchId/recipients/:recipientId/generation/complete` — verifies current lease/approved revision, records key/checksum/size, and atomically marks the recipient generated. Repeated completion with the same checksum is idempotent; a conflicting checksum is rejected and audited.
- `POST /api/v1/batches/:batchId/generation/fail` — record a safe structured failure. Only retry conditions classified as transient; mark permanent incompatibility/input errors for correction.
- `POST /api/v1/batches/:batchId/actions/pause`, `/resume`, `/cancel` — update desired state. Pause/cancel are cooperative and checked at unit boundaries; accepted email cannot be unsent.

### 19.5 Email dispatch, delivery events, downloads and deletion

- `POST /api/v1/batches/:batchId/delivery/prepare` — validate consent/authorization checkbox, quota, generated PDF presence, valid email address and batch approval; create logical send intents with stable keys.
- `POST /api/v1/batches/:batchId/delivery/dispatch` — frontend trigger for a small bounded unit of due items; Hono claims each item, fetches approved PDF from private R2, calls provider, persists the attempt and returns per-item outcomes. The route must have a bounded timeout and should not attempt a full 5,000-email batch in one invocation.
- `POST /api/v1/webhooks/email/:provider` — verify provider signature, insert event idempotently, then update recipient delivery state under allowed transition rules. Never trust unsigned event bodies.
- `POST /api/v1/batches/:batchId/downloads/presign` — authorize ownership and issue short-lived GET URL for one generated PDF/object; ZIP generation stays in the browser and uses bounded local processing.
- `POST /api/v1/batches/:batchId/retention/run` — internal/authorized housekeeping entry point to process due deletion tasks. It must not be a public unauthenticated endpoint. A scheduled call is only a best-effort safety net under constrained hosting; API requests may also opportunistically process a small cleanup chunk.
- `GET /api/v1/batches/:batchId/cleanup-status` — report retention deadline and cleanup status without exposing expired recipient data.

The exact route names are proposed, not user-approved. The API schema should eventually be published in OpenAPI or generated from the shared Zod schema package.

## 20. State machines and invariants

### 20.1 Batch lifecycle

`draft → importing → review → approved → active → (paused ↔ active) → completed | partial | failed | canceled → expiring → expired`

Not every batch needs every status. `partial` means terminal mixed outcomes (for example, some recipient PDFs generated while a subset permanently failed). A batch can be generation-complete but email-incomplete, so lifecycle must be paired with independent generation and delivery state axes rather than a single overloaded status.

### 20.2 Generation state per approved recipient

`pending → leased → generated`

`leased → pending` after an expired lease or a known retryable worker interruption.

`leased → failed` for a terminal error such as an unsupported template/row value after bounded retry policy.

`pending/leased → canceled` only for work not already committed; if generation finished and object upload succeeded, retain the result and mark it completed rather than deleting it silently.

A generated row is valid only when an approved snapshot exists, the object key is server-scoped to that row/revision, the upload is confirmed, and the checksum/size are recorded.

### 20.3 Delivery state per recipient

`not_requested → queued → leased/attempting → accepted`

From `accepted`, provider events can progress to `delivered`, `bounced`, or `complained` if the provider reports them. A known transient error enters `retry_wait → queued` if attempts remain. A known permanent address/content error enters `failed_permanent`. A network timeout after the request may have reached the provider enters `unknown → reconciliation_pending` (can be a substate or associated work item); it must not be treated as safe-to-retry by default. Pause prevents new claims but does not reverse accepted sends. Cancel marks unsent work canceled while preserving attempted/accepted delivery facts.

Delivery events may arrive out of order. Rules should be monotonic where sensible (e.g. don't turn a delivered event back into queued); complaints/bounces remain terminal flags even if another event arrives. Keep raw provider event payloads minimal and process each provider event ID at most once.

### 20.4 MongoDB concurrency protocol

- Claim work using an atomic predicate on status and eligibility (`availableAt <= now`, no active lease or expired lease) and set `leaseOwner`, `leaseExpiresAt`, and `status=leased` in one update.
- Use compare-and-set filters for every status transition (expected prior state and snapshot/revision match). MongoDB guarantees atomicity at a single-document write level; multi-document bulk writes are not atomic as a whole.
- Never rely only on an in-memory JS mutex, browser state, or an incremented counter to avoid duplicate work.
- Use unique indexes on the logical operation key and delivery key as the last line of defense against races.
- Reconcile summary counters periodically/on progress requests from recipient states; treat counters as denormalized cache, not truth.
- Use a two-phase import/approval pattern instead of one enormous multi-document transaction: ingest into a revision; validate expected counts/digest; create immutable snapshot rows in chunks; only then atomically mark snapshot `ready` and batch `approved`.

## 20. State machines and invariants

### 20.1 Batch lifecycle

`draft → importing → review → approved → active → (paused ↔ active) → completed | partial | failed | canceled → expiring → expired`

Not every batch needs every status. `partial` means terminal mixed outcomes (for example, some recipient PDFs generated while a subset permanently failed). A batch can be generation-complete but email-incomplete, so lifecycle must be paired with independent generation and delivery state axes rather than a single overloaded status.

### 20.2 Generation state per approved recipient

`pending → leased → generated`

`leased → pending` after an expired lease or a known retryable worker interruption.

`leased → failed` for a terminal error such as an unsupported template/row value after bounded retry policy.

`pending/leased → canceled` only for work not already committed; if generation finished and object upload succeeded, retain the result and mark it completed rather than deleting it silently.

A generated row is valid only when an approved snapshot exists, the object key is server-scoped to that row/revision, the upload is confirmed, and the checksum/size are recorded.

### 20.3 Delivery state per recipient

`not_requested → queued → leased/attempting → accepted`

From `accepted`, provider events can progress to `delivered`, `bounced`, or `complained` if the provider reports them. A known transient error enters `retry_wait → queued` if attempts remain. A known permanent address/content error enters `failed_permanent`. A network timeout after the request may have reached the provider enters `unknown → reconciliation_pending` (can be a substate or associated work item); it must not be treated as safe-to-retry by default. Pause prevents new claims but does not reverse accepted sends. Cancel marks unsent work canceled while preserving attempted/accepted delivery facts.

Delivery events may arrive out of order. Rules should be monotonic where sensible (e.g. don't turn a delivered event back into queued); complaints/bounces remain terminal flags even if another event arrives. Keep raw provider event payloads minimal and process each provider event ID at most once.

### 20.4 MongoDB concurrency protocol

- Claim work using an atomic predicate on status and eligibility (`availableAt <= now`, no active lease or expired lease) and set `leaseOwner`, `leaseExpiresAt`, and `status=leased` in one update.
- Use compare-and-set filters for every status transition (expected prior state and snapshot/revision match). MongoDB guarantees atomicity at a single-document write level; multi-document bulk writes are not atomic as a whole.
- Never rely only on an in-memory JS mutex, browser state, or an incremented counter to avoid duplicate work.
- Use unique indexes on the logical operation key and delivery key as the last line of defense against races.
- Reconcile summary counters periodically/on progress requests from recipient states; treat counters as denormalized cache, not truth.
- Use a two-phase import/approval pattern instead of one enormous multi-document transaction: ingest into a revision; validate expected counts/digest; create immutable snapshot rows in chunks; only then atomically mark snapshot `ready` and batch `approved`.


---

<!-- Source file: 09_EMAIL_DELIVERY_AND_PROVIDER_STRATEGY.md -->

# Email Delivery and Provider Strategy

## 21. Delivery recovery and quota behavior

1. **Preparation:** ensure approved snapshot, generated object, recipient email, authorization/consent and quotas all pass. Do not queue unknown or invalid recipients.
2. **Intent:** create a `deliveryAttempt`/logical send operation with a durable application idempotency key and unique index before sending.
3. **Claim:** one Hono dispatch claims only a bounded number of due items with lease and attempts guard.
4. **Provider call:** load PDF from R2 server-side, enforce message-size envelope, attach PDF and send using a server-only API credential. Do not allow the client to select arbitrary sender fields.
5. **Persist response:** on definite provider acceptance, store provider message ID and set `accepted`; on known transient failure, schedule retry with `availableAt`; on permanent failure, mark it terminal; on ambiguous timeout, mark unknown and reconcile before a new send.
6. **Retry:** five total attempts maximum for known transient failures; exponential backoff plus jitter, clamped to provider `Retry-After`/quota windows. Respect daily/monthly caps and do not spam retries while waiting for next allowance. Permanent failures are not retried automatically.
7. **Webhook/event:** verify signature; insert provider event using unique event ID; update delivery state idempotently. Provider acceptance is not inbox delivery.
8. **Browser closure:** current selected model pauses dispatch. The next browser session fetches persisted statuses and resumes. Any active lease expires safely; do not automatically resend an item in `unknown`.
9. **Duplicate prevention:** application operation key should include provider, batch ID, approved snapshot ID, recipient ID and message purpose/revision. Provider idempotency is supplemental; Resend documents a 24-hour retention window for its keys.
10. **Quota exhaustion:** set eligible work to `retry_wait`/`waiting_for_quota` and show clear free-tier cap; do not make the user keep the tab open pointlessly until the next provider allowance. Resume when the next dispatch window is eligible.

## 37. Nodemailer, batch sending, and the actual throughput limit

### 37.1 Important correction: Nodemailer is not an email service

Nodemailer is a Node.js library for composing and transporting mail. Its standard SMTP transport sends through an SMTP relay; it also documents a dedicated Amazon SES API transport. Nodemailer can manage connections/pooling and can be used to implement controlled concurrent dispatch, but it cannot raise the provider's daily/monthly quota, bypass sending policies, establish sender reputation, or make a free email provider unlimited. Official references: https://nodemailer.com/transports and https://nodemailer.com/smtp.

The product must distinguish three different limits:

1. **Application/API throughput:** how many dispatch requests the frontend and Hono can process per second.
2. **Provider API request batching/rate limits:** how many messages can be described in one API call and how many API calls are allowed.
3. **Provider account sending quota:** how many actual emails the account is permitted to send per day/month or at its approved sending rate.

Reducing the number of API requests can improve efficiency for the first two limits. It does not increase the account-level allowance in the third category.

### 37.2 Provider facts checked on 10 October 2026

- **Brevo Free:** its official plan page currently lists 300 email sends per day, transactional email, and up to 100,000 contacts. The daily send cap resets daily and unused quota does not roll over. Its help page says transactional messages beyond the cap may be held in a retry queue up to a stated limit, but that queue must not be relied on as the application's own authoritative delivery/recovery system. Sources: https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans and https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan.
- **Brevo batch transactional API:** official documentation allows up to 1,000 personalized message versions in one API request and describes a 100-requests-per-minute endpoint rate limit, with other request recipient/version limits. This is an API efficiency feature, not a promise of 1,000 free sends/day. Source: https://developers.brevo.com/docs/batch-send-transactional-emails.
- **Important fit gap for our attachment requirement:** the documented `messageVersions` override fields include recipient, subject, reply-to, content and parameters, but do not document per-version unique attachment overrides. The standard transactional endpoint has an attachment field, but it is not safe to assume that a different PDF can be attached to each message version within one batch request. A proof-of-concept must verify this. If per-recipient attachment cannot be done safely with the batch endpoint, use one API call per recipient (concurrency-limited) or reconsider secure expiring PDF links in a future product decision. Do not send the same shared attachment to all recipients by accident. Source: https://developers.brevo.com/docs/batch-send-transactional-emails and https://developers.brevo.com/reference/send-transac-email.
- **Brevo SMTP relay:** the official documentation explicitly says SMTP relay does not support batch sending; use the batch API for batch operations. Nodemailer connected to Brevo SMTP would still be an individual-message SMTP path and would remain subject to Brevo account quotas. Source: https://developers.brevo.com/docs/smtp-integration.
- **Resend Free:** currently lists 3,000 emails/month and 100 emails/day. Source: https://resend.com/pricing.

These provider limits and plans are changeable and must be reconfirmed at the time of account creation and before public launch.

### 37.3 Recommended email implementation, when the project reaches that milestone

1. Keep the user-selected first prototype **downloads-first**. Add no real recipient email sends to the first production-like test.
2. Define a provider-agnostic interface, for example:
   - `sendOne(message)` for one recipient and that recipient's own attachment;
   - optional `sendBatch(messages)` only when provider capability tests demonstrate that per-message personalized attachments are supported safely;
   - `getCapabilities()` for daily quotas, supported attachment mode/size, API batching, webhook events and idempotency properties;
   - `normalizeWebhookEvent(event)` and `classifyError(error)`.
3. Compare Brevo and Resend under the zero-cost constraint. Brevo is a useful first candidate because of its higher published daily cap, but it is not yet selected. Check sending-domain/sender verification, exact free transactional eligibility, PDF attachment behavior, response identifiers, webhook signatures, bounce/complaint events and provider terms.
4. Prefer the provider's HTTPS API from Hono for the first integration if it meets the feature needs. Nodemailer is optional when its transport abstraction offers a practical benefit. If used, keep it on the server and rate-limit it; do not import it in the Vite frontend.
5. Hono claims one recipient-send intent at a time using a persistent idempotency/operation key. Use bounded concurrency and provider limits, classify errors, preserve provider IDs, and use webhooks/events to update later delivery results. An ambiguous network timeout becomes `unknown` and is reconciled; it is not blindly retried.
6. Do not put recipients with different documents in `To`/`CC`/`BCC` as a shortcut. Each message must go only to its intended recipient, with the attachment hash and recipient/snapshot key cross-checked before dispatch.
7. Under the strict output deadline, the app must estimate whether a batch can finish sending within the selected retention period. If not, clearly warn/block before delivery starts; if files expire with pending recipients, mark `expired_unsent` and stop those sends. Do not keep expired copies to finish the queue without explicit user approval and a future policy change.


---

<!-- Source file: 10_SECURITY_PRIVACY_AND_RETENTION.md -->

# Security, Privacy and Retention

## 7. Security and privacy baseline to design

- Treat all PDFs and spreadsheets as untrusted input.
- Validate file signatures and parseability, not only filename/MIME type; enforce upload limits and row/page limits.
- Keep uploads outside any executable/public web root; use private object storage, short-lived authorization and least-privilege credentials.
- Isolate processing workers and impose CPU, memory, page-count and runtime limits to reduce denial-of-service risk from malformed or expensive PDFs.
- Use authentication, object-level ownership checks, rate limits, CSRF protections where applicable, secure session/token handling and password-reset protections.
- Do not log full recipient rows, PDF contents, email addresses or signed URLs unnecessarily. Sanitize errors and keep secrets out of client bundles.
- Prevent cross-user access to templates, ZIPs, PDFs, job details and preview endpoints.
- Track delete requests and cleanup failures. Explain to users that provider backups/logs can have separate retention terms where applicable.
- For email, include abuse prevention, sender verification, suppression/bounce handling, and acceptable-use controls before public launch.

## 22. Retention and deletion protocol

Presets: 24 hours, 7 days, and 30 days are the selected proposed launch options. The timer's exact start event remains to be chosen (recommended: job's terminal/completed timestamp for outputs, and creation timestamp for failed abandoned drafts, with explicit display in UI). Template source PDFs and reusable mappings remain until template deletion.

Deletion should be a process, not only a TTL field:

1. Set retention deadline and expose the deadline to the user.
2. Create idempotent cleanup tasks for every R2 object that belongs to expired job state.
3. Delete objects through R2; on failure, keep task retryable with safe error code and attempt metadata.
4. Remove or redact recipient data, imported values and delivery addresses only after deciding whether active send/reconciliation work is still outstanding; do not expire data needed to reconcile an ambiguous in-flight send without first setting a documented cutoff rule.
5. Replace long-term job record with aggregate counts/status/timestamps only; never keep name/email/address data after the selected retention period.
6. Confirm cleanup state after storage deletion succeeds; retain cleanup failure flags until reconciled.
7. MongoDB TTL can be used as a fallback for eligible database records but is asynchronous and does not delete R2 files. R2 lifecycle rules may provide a backstop, but app-level object tracking and delete retries remain necessary. Cloudflare currently documents that objects are typically removed within 24 hours after their lifecycle `x-amz-expiration` value, and existing objects can take longer when lifecycle rules change; therefore an R2 lifecycle policy is not an exact-time deletion guarantee. A 24-hour user retention preset must be represented as a deletion deadline plus cleanup status/retries, not a claim that every physical copy is erased exactly at hour 24.

**Honesty constraint:** With browser-driven work and a serverless host that may not run continuously, the app can promise a configured retention deadline plus best-effort/retry deletion and expose cleanup status, but must not claim exact-to-the-minute physical erasure until the storage/scheduler arrangement is proven. Public privacy text must reflect the implementation actually deployed.

## 23. Security and abuse controls required by the chosen architecture

- Google ID tokens are verified on the server for signature, audience, issuer and expiry. Use `sub` as the unique identity; do not trust decoded client-side claims.
- Session cookies: HttpOnly, Secure in production, intentional SameSite behavior, rotation/revocation policy, CSRF defenses, exact credentialed CORS origin allowlist. Avoid wildcard origin with credentials. The frontend/API deployment must be tested in real target browsers.
- R2: private bucket, random server-generated keys, short-lived operation-scoped presigned URLs; exact allowed CORS origin/method/header set; verify final object metadata/checksum after upload. Never log or analytically collect signed URLs. Presigned URLs can be reused until expiry, so they are not one-time tokens.
- PDF/XLSX/CSV: untrusted input. Check magic bytes/content, byte size, page count, row and column counts, XLSX decompressed size, encrypted/corrupt PDFs, and unsupported features. Treat spreadsheet values as data, never as executable HTML or formulas; escape on render/export.
- Browser-produced PDFs: the server cannot independently prove that a modified client generated exactly the pixels implied by a snapshot. This is acceptable only as a stated MVP trust boundary; do not market outputs as tamper-proof or cryptographically attested. A future server-side validation or signed-verification feature would need additional design.
- Provider: email secret only in Hono environment variables; sender address constrained to verified configuration; per-account/global quotas; recipients should be authorized to receive the document; suppression lists for bounce/complaint; verified webhooks; emergency global send pause.
- Rate limits: auth, create batch, import, upload URL issuance, generation claim, delivery dispatch, and webhook replay. Quota must be enforced server-side, not solely in React.
- Authorization: every resource query includes owner ID; an ObjectId/opaque ID is not authorization. Test cross-account template, row, R2 key, output, job and download access.
- Observability: structured request ID, stable error code, stage and timings. Redact recipient data, tokens, full filenames where sensitive, message body, uploaded content, provider secrets and presigned URLs.
- Dependency/security: keep PDF parser/renderer and XLSX parser updated; establish lockfiles, automated dependency advisories, secret scanning and a process to respond to vulnerable file parsing packages.


---

<!-- Source file: 11_HOSTING_STORAGE_AND_ZERO_COST_CONSTRAINTS.md -->

# Hosting, Storage and Zero-Cost Constraints

## Explicit constraints and choices

- A strict $0 infrastructure budget was explicitly selected.
- Hono on Vercel is the intended private prototype arrangement, not a confirmed public launch host.
- React/Vite and API source code are in separate repositories, with same-origin browser/API access desired.
- MongoDB is the source of truth for app metadata, job state and queue records.
- Cloudflare R2 is the selected object-storage candidate.
- PDF generation is browser-side and pauses on browser close.
- Live email is after the downloads-first prototype.

## Vercel/Hono

Hono is technically supported on Vercel. However, Vercel Hobby terms restrict use to personal/non-commercial purposes. It is selected only for a private prototype. Public release needs a hosting option whose current terms fit the intended use and the hard $0 constraint; do not silently move to a paid plan.

Vercel Functions have a documented 4.5 MB request/response body limit. Upload PDFs/ZIPs directly to private R2 using short-lived, object-scoped signed URLs rather than routing large file bodies or base64 attachments through Hono.

Same-origin access can be achieved only if deployment routing/domain configuration supports it. Confirm the real cookie/API topology in preview deployments. The source repos can remain separate while being exposed under one origin.

## Cloudflare R2

The published R2 standard free allowance observed on 10 October 2026 was 10 GB-month storage, 1 million Class A operations/month, 10 million Class B operations/month and no internet egress fee. Overages can be billed. R2 lifecycle expiration is asynchronous; objects are typically removed within 24 hours of the expiration field, and existing objects after rule changes may take longer. Application-side caps and a direct cleanup sweep are required.

Use separate private object namespaces for:
- Saved template source PDFs (retained until template deleted).
- Temporary input files.
- On-demand preview artifacts.
- Per-recipient generated PDFs.
- ZIP archives.

All keys should be server-derived/validated; never let a user choose arbitrary bucket keys. Presigned URLs should be short-lived and scoped to a single object and operation.

## MongoDB Atlas and state size

A free Atlas cluster has constrained storage/resources; historical discovery described the M0 quota as 512 MB, but the plan details must be rechecked immediately before use. Keep PDFs/ZIPs in R2, not MongoDB. Recipient states, indexes, provider events, import snapshots and audit rows also consume storage. Aggregate history after expiry and avoid indefinite retention of recipient PII/provider details.

MongoDB TTL deletion is asynchronous and not a precise deletion clock. Use explicit expiration timestamps, a cleanup ledger and cleanup retries. TTL may be a backstop only.

## MongoDB-backed queue under browser orchestration

A queue record does not run by itself. The user selected a MongoDB queue direction, but the process that claims/drives work must be explicit. The initial execution trigger is browser-driven chunks and the selected behavior is pause/resume on return. A future autonomous worker/scheduler would change the operational model and may require revisiting hosting and budget.

## Email under strict $0

Provider quotas, not Nodemailer or HTTP batch size, determine how many messages may be sent per day/month. Brevo Free was observed at 300/day, while Resend Free was observed at 100/day and 3,000/month. 5,000 recipients need at least 17 days at 300/day or 50 days at 100/day, ignoring other limits. This interacts badly with 24-hour/7-day output expiry. The selected rule is strict expiry and `expired_unsent`, not silent retention extension.

## Render, Redis and SES notes from discovery

- Render Free has sleep/ephemeral filesystem/in-memory free Key Value constraints and blocks outbound SMTP ports 25/465/587; it should not be presumed suitable as the durable worker/storage layer.
- Upstash Redis + BullMQ was considered but is not the selected queue direction. It would still require a durable consumer and consume a free command budget.
- Amazon SES sandbox restrictions and 2026 pricing changes mean it should not be treated as permanently free without verification of the account/plan.

## Cost and eligibility policy

- Do not add paid hosting or queue services by assumption.
- Add application usage caps, storage quotas, upload/row/page limits, send caps and a kill switch.
- If a reliable, eligible public solution cannot fit $0, record the infeasibility and ask for a changed constraint instead of weakening correctness, privacy or the strict deadline silently.
- Do not claim always-on background work when the design depends on the browser being open.

## Official references

- Vercel terms: https://vercel.com/legal/terms
- Hono on Vercel: https://vercel.com/docs/frameworks/backend/hono
- Vercel function limits: https://vercel.com/docs/functions/limitations
- R2 pricing: https://developers.cloudflare.com/r2/pricing/
- R2 lifecycle: https://developers.cloudflare.com/r2/buckets/object-lifecycles/
- Atlas pricing: https://www.mongodb.com/pricing
- MongoDB TTL: https://www.mongodb.com/docs/v8.0/core/index-ttl/
- Render free: https://render.com/docs/free


---

<!-- Source file: 12_ROADMAP_REPOSITORIES_CICD_AND_ENVIRONMENT.md -->

# Roadmap, Repositories, CI/CD and Environment

## 30. Implementation roadmap — proposed, not yet user-approved

This roadmap is recommended to de-risk the product in dependency order. The key principle is **prove browser-side PDF fidelity and same-origin auth/storage first; do not build all product screens before these experiments succeed.**

### Milestone 0 — Repository and platform feasibility spike

**Deliverables**
- Two separate repositories (provisional names: `bulk-document-web` and `bulk-document-api`; names not a user decision).
- Web: React + Vite + TypeScript; API: Hono + TypeScript + Zod.
- Vercel projects for private prototype only, with `/api/*` rewrite to the API deployment. No assumption of eligibility for a later public launch.
- MongoDB Atlas Free connection from Hono with one cached/reused client per warm invocation environment where appropriate.
- R2 private bucket, scoped PUT/GET presigned URLs, and CORS restricted to prototype origin.
- Google Identity credential -> Hono ID-token verification -> app cookie -> `GET /api/v1/me` smoke test.

**Acceptance criteria**
- Requests from the frontend use `/api/*` on the frontend browser origin.
- Cookie set through the rewrite is stored and sent on the next API request in current Chromium and Firefox; cookie has intended path/security attributes.
- Invalid, expired, wrong-audience and missing Google credentials are rejected.
- API secrets never appear in frontend build output or source maps.
- A source PDF larger than the function body limit can be uploaded directly to R2 using a short-lived presigned URL; the API never receives the PDF bytes.
- Wrong-origin CORS requests and cross-account object access fail.

### Milestone 1 — PDF vertical-slice prototype

**Deliverables**
- PDF.js rendering/extraction and candidate placeholder detection.
- Visual field mapping for a manually selected region; page/viewport-to-PDF coordinate transforms with rotation/page-size handling.
- `pdf-lib` overlay masking + font embedding + text drawing, with field-level alignment and fit-to-width behavior.
- A shared transformation module used by draft previews and final PDFs.
- A representative fixture corpus before claiming support for complex PDFs.

**Acceptance criteria**
- Placeholder candidates are suggestions, not unreviewed automatic changes.
- Token-over-pattern/background is rejected or requires explicit confirmation; no silent unsafe white rectangle on a textured background.
- Test UTF-8/Unicode names, long strings, numbers/dates, font embedding, multiple page sizes, rotation, multi-page fields, split token fragments, corrupted/encrypted/image-only files and visual overlap.
- Every preview comes from the same PDF-generation code path as the final artifact; visible rendering uses PDF.js.
- At least 500 records can be run in a repeatable browser benchmark on the chosen pilot fixtures without tab freeze/crash; record peak memory/time rather than promising a universal time.

### Milestone 2 — Secure account, templates and storage lifecycle

**Deliverables**
- Google-only registration/login with verified ID tokens and app session cookie.
- Per-user template CRUD/versioning; original template PDF is retained until user deletes its template.
- Object metadata records size, content type, checksum, creator, purpose, opaque key and lifecycle status.
- Draft/source upload constraints and private download URLs.
- Deletion task ledger and idempotent cleanup path.

**Acceptance criteria**
- All templates/jobs/objects are scoped to owner; cross-user access test matrix passes.
- PDF bytes and recipient spreadsheets are never stored in MongoDB document fields.
- Object deletion failures are recorded and retried; cleanup ledger does not store recipient names/emails.
- Template versions used by an approved snapshot remain immutable until that job no longer requires them.

### Milestone 3 — CSV/XLSX import, validation, diff and review gallery

**Deliverables**
- CSV/XLSX parsing in the browser with file limits and typed normalization; Hono re-validates untrusted values at API boundaries.
- Explicit column mapping for text/date/number fields.
- Staged, chunked import endpoint and `batchImports` revision model.
- Inline correction, validation feedback, and re-import preview showing added/removed/changed/duplicate/conflicting records.
- Manual reconciliation for uncertain matches; no silent row-index merge.
- Review gallery with pagination/search and on-demand preview generation using the shared pipeline.

**Acceptance criteria**
- Invalid rows are individually blocked; valid rows remain available for the batch.
- Duplicate emails are warnings and never cause automatic row deletion.
- Import request chunks remain under Vercel payload limits; no single request tries to push an entire large XLSX/JSON dataset.
- User edits are represented as explicit overrides; re-import diff is reviewed before applying.
- Every draft can be browsed before approval, with long/missing/overflow-risk fields highlighted.

### Milestone 4 — Approval snapshot, generation and resume

**Deliverables**
- Immutable approved snapshot containing template version/checksum, mappings, formatting settings, data revision and effective per-row data.
- MongoDB-backed work-item claim/lease protocol with unique operation keys.
- Browser Web Worker generating bounded chunks and uploading each PDF to R2; finalize after checksum/size validation.
- Batch progress and cooperative pause/resume/cancel operations.
- Polling UI backed by persisted state.

**Acceptance criteria**
- Double-submit or concurrent claims cannot generate two authoritative outputs for one `(snapshotId, recipientKey)`.
- Refresh/browser close leaves completed work recorded; expired leases can be reclaimed without overwriting a completed result.
- Pause stops claiming new work and is honored at chunk boundaries; cancel stops unsent/unstarted work while keeping completed records.
- Approving a new revision creates a new snapshot rather than mutating outputs already generated/sent.
- Benchmark 500, 1,000 and 5,000 recipient fixtures on representative low-memory hardware; publish only measured limits.

### Milestone 5 — ZIP, individual downloads and retention

**Deliverables**
- Browser-bounded ZIP packaging; split to multiple archives when the tested memory/output limit requires it.
- Optional individual download through an authorized, short-lived URL.
- Retention presets of 24 hours, 7 days and 30 days; abandoned drafts expire from creation, generated-output timer begins at terminal generation as selected.
- Cleanup tasks processed by an idempotent sweep; R2 lifecycle is a backstop, not the only deadline mechanism.

**Acceptance criteria**
- ZIP/individual outputs contain exactly the expected recipient files; safe deterministic filenames and no path traversal.
- ZIP completion can recover from a failed attempt without corrupting or silently omitting files.
- Cleanup is repeatable and records object deletion outcomes; the UI discloses configured expiry and realistic cleanup lag.
- The retention-vs-pending-delivery conflict in Section 28.1 is resolved before email delivery is enabled for large batches.

### Milestone 6 — Email provider proof-of-concept and delivery reliability

**Deliverables**
- Provider-adapter interface with `sendOne`, `getCapabilities`, `normalizeWebhookEvent` and provider error classification. Do not select a provider until the comparison matrix is tested.
- Verified sender setup; individual recipient intents and attachment-size checks.
- API-side send in bounded units initiated by the browser; durable attempt records, provider IDs and HMAC/signature-verified webhooks.
- Distinct `accepted`, `delivered`, `bounced`, `complained`, `failed`, `unknown` and `expired_unsent` states as supported by provider capabilities.
- Bounded retries (proposed maximum five attempts for eligible transient failures) with exponential backoff/jitter and `Retry-After` handling; never blind-retry an unknown outcome.

**Acceptance criteria**
- Provider keys appear only in server-side environment configuration.
- Test one individual attachment per recipient; verify that each attachment hash matches that recipient's approved output.
- Duplicate dispatch, webhook replay, webhook out-of-order, provider 429/5xx, ambiguous timeout after acceptance, permanent bad recipient and account quota exhausted all result in non-duplicating recoverable states.
- Provider daily/monthly cap is enforced by Hono with per-account and global budgets; UI shows that sending may take days and can pause when browser dispatch is inactive.
- No bulk sending to real recipients during first test; use test inboxes and provider sandbox/test mode where available.

### Milestone 7 — Private pilot hardening

**Deliverables**
- End-to-end/fault-injection suite, security review, upload abuse limits, email-sending kill switch, quota dashboards, alert/log policy, account deletion behavior and acceptable-use/recipient-authorization UX.
- Usage guardrails to protect zero-cost provider limits: per-user active batch cap, file/row/total-output budgets, request rate limits and storage alerts.
- Privacy/retention page that clearly distinguishes application deadline from provider/lifecycle cleanup delay.

**Acceptance criteria**
- All auth, cross-account access, upload validation, no-secret-in-client, retry/idempotency, paused/canceled batch, cleanup and unknown-delivery tests pass.
- 5,000-recipient support is not advertised until browser PDF generation, output storage, ZIP creation and job recovery have been benchmarked end-to-end.
- Public sign-up and public bulk sending remain disabled until a compliant public hosting option is established under the intended use and zero-cost constraint is re-evaluated.

## 31. Separate repository setup and CI/CD — recommended plan

### 31.1 Repositories

Maintain separate repositories as selected. Suggested names are provisional:

- `bulk-document-web`: React, Vite, PDF.js preview, browser Web Worker, `pdf-lib` output, import/review gallery and polling client.
- `bulk-document-api`: Hono routes, Google ID-token verification, cookie/session lifecycle, Zod request validation, MongoDB repositories, work leases, R2 presigned URLs, email-provider adapter, webhook verification and cleanup route.

Avoid copying API types manually without drift detection. Recommended contract workflow: generate an OpenAPI JSON document from Hono/Zod routes in the API repository; version/commit that contract as a CI artifact or generated file in the web repo; use a generated TypeScript client/types on the frontend; CI fails when a route/schema change has not updated the contract. This gives separate repos an explicit contract without requiring a monorepo or paid private package registry.

### 31.2 Branch and pull request checks

For each repository, require PR checks before merging to the default branch:
1. Install exact lockfile dependencies in frozen/CI mode.
2. Format check and ESLint.
3. TypeScript typecheck.
4. Unit tests and contract/schema tests.
5. Production build.
6. Dependency/security checks and secret scan.

Web repository should add Playwright smoke tests for login route, template upload flow, import/review and job progress with network fixtures. API repository should include route/auth tests plus MongoDB integration tests in a disposable CI service/container where supported. Use test doubles for email and R2 in routine PRs, then run an explicit integration smoke suite against a dedicated test bucket/provider test inbox outside the production namespace.

### 31.3 Deployment promotion

- Pull requests: checks and preview deployments using non-production settings and fake/mock email sender.
- Main branch: deploy the private prototype's Vercel web project and separate Hono API project.
- Environment promotion: use separate development/test/prototype credentials, bucket prefixes or buckets, and database namespace. Never use one broad R2 credential for all environments if narrower credentials are possible.
- Public launch: not permitted by this plan until hosting eligibility and always-on/background-service expectations are resolved. Vercel Hobby's non-commercial terms are a prototype constraint, not a public-product decision.
- Rollback: each deployment must be reversible without mutating approved snapshot schemas. Use additive schema changes first and include an explicit rollback note for API routes and database migrations.

## 32. Environment configuration and secret management

### Frontend (`bulk-document-web`)

Example non-secret build-time variables:

```text
VITE_GOOGLE_CLIENT_ID=
VITE_API_BASE_URL=/api
```

Any `VITE_*` variable is bundled into client code and must be treated as public. Never put `MONGODB_URI`, R2 secret keys, email API keys, session secrets or webhook secrets in the frontend environment.

### API (`bulk-document-api`)

Required variables should be documented in `.env.example` with empty placeholders, never real credentials:

```text
NODE_ENV=development
APP_ORIGIN=http://localhost:5173
GOOGLE_CLIENT_ID=
MONGODB_URI=
MONGODB_DATABASE=
SESSION_HMAC_SECRET=
R2_ACCOUNT_ID=
R2_ENDPOINT=
R2_BUCKET_NAME=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
EMAIL_PROVIDER=disabled
EMAIL_API_KEY=
EMAIL_FROM=
EMAIL_WEBHOOK_SECRET=
CRON_SECRET=
```

Notes:
- If using opaque random session IDs stored server-side, `SESSION_HMAC_SECRET` may instead serve CSRF/state-token signing; document its specific purpose rather than adding unused secrets.
- Keep provider disabled by default. Deployment should fail closed or expose downloads-only behavior if `EMAIL_PROVIDER` is disabled or credentials are missing.
- `CRON_SECRET` only applies if a scheduled cleanup endpoint is used; require an authorization check for its invocation.
- Validate required variables at startup and return safe configuration errors without printing credentials.
- In development, use a local `.env` excluded from Git; in deployment use the platform's secret manager/environment settings. Rotate credentials immediately if exposed in logs or repository history.
- Presigned URLs are bearer capabilities: make them short-lived, object-specific, method-specific, and never log their full query strings.

## 33. End-to-end acceptance criteria for the complete MVP

A release candidate is acceptable only when the following end-to-end journey succeeds:

1. A user signs in with Google; Hono verifies the token and creates an app session. The browser uses the same-origin `/api` path. Another account cannot access the user's resources.
2. The user uploads a supported text PDF directly to a private R2 object with an authorized short-lived URL. The template stores a checksum and version; PDF contents are not stored in MongoDB.
3. The user maps detected placeholders or visual regions, previews masking, and gets a clear rejection/warning for unsupported background/layout behavior.
4. The user imports CSV/XLSX, maps columns, sees normalized rows, missing values, invalid dates/numbers, duplicate addresses and likely overflow. Valid rows remain usable while invalid rows are individually blocked.
5. Re-import creates a diff. Stable unique matches are reconciled, ambiguous matches require manual review, and inline overrides are preserved or explicitly resolved.
6. The user browses every draft through the shared preview/final-generation pipeline, including long-name and boundary-value examples.
7. Approval creates one immutable snapshot. Changing a draft later cannot mutate that snapshot or its outputs.
8. The browser generates PDFs using bounded Worker chunks and direct R2 uploads. A tab close leaves completed work recorded; reopening the app resumes uncompleted work after lease recovery without duplicating authoritative outputs.
9. Pause/cancel stops new work at chunk boundaries. All completed files and prior send outcomes remain accurately recorded.
10. The user downloads a valid ZIP (or multiple bounded ZIP parts) and any authorized individual PDF. File names are deterministic, safe and mapped to the correct records.
11. If email is enabled, every sent message has one intended recipient and the matching recipient's PDF, is authorized by Hono, and obeys provider/global/account quotas. Detailed provider states are visible where supported.
12. Injected provider timeout after acceptance creates an `unknown` state and is reconciled rather than blindly resent. Retryable errors use bounded backoff; permanent errors are actionable; signed webhook events are deduplicated.
13. At retention deadline, unsent/unknown cases are surfaced to the organizer before cleanup. The chosen unresolved policy must define whether pending recipients become `expired_unsent`, use a separately disclosed delivery-retention window, or are blocked from creating batches that cannot fit the configured retention.
14. Cleanup works with the browser closed, at least through a verified scheduled sweep plus lifecycle backstop for the private prototype. Every deletion is idempotent, failures remain visible, and expired recipient PII is not retained in cleanup history.
15. The actual measured batch, bytes, page count, preview latency and ZIP memory usage are captured as benchmark results. Only measured capabilities become documented limits; no untested fixed completion-time promise is made.


---

<!-- Source file: 13_TEST_MATRIX_AND_ACCEPTANCE_CRITERIA.md -->

# Test Matrix and Acceptance Criteria

## 24. Test matrix / acceptance gates

### 24.1 Unit and contract tests

- Zod schemas for every API body/query/path; invalid and oversized requests.
- Google token validation: expired, wrong audience, wrong issuer, wrong signature, absent subject; session cookie and CSRF/origin failure.
- Import normalization: Unicode, CSV quoting/line endings, date/number formats, missing required values, duplicate addresses, shared address with multiple documents, re-import diff, conflicting inline overrides.
- Field coordinates: viewport-to-PDF transforms, rotation, page dimensions, multi-page mapping, fit/wrap/min-font rules.
- State transition guards; paused/canceled jobs cannot acquire new work; old snapshot cannot mutate; an invalid transition has no side effect.
- Application idempotency unique key; duplicate click and parallel dispatch; idempotent provider webhooks.
- Retry classification: 429, 5xx, network timeout, retry-after, known permanent 4xx and ambiguous outcomes.
- Retention deadline logic, cleanup idempotency, cleanup retry and PII redaction.

### 24.2 PDF visual fixture suite

Use fixture files for standard tokens, token split across text fragments, Unicode/long names, long numbers/dates, missing fonts, rotated pages, different page sizes, transparent or textured backgrounds, field collision with logos, multiple pages, password-protected/encrypted documents, corrupted PDFs, image-only/scanned PDFs, and unsupported form/XFA content. Use rendered image comparisons to catch white-mask blocks, misaligned text, cut glyphs and accidental overlap. The app should clearly reject unsupported cases instead of silently issuing bad output.

### 24.3 Browser and ZIP benchmarks

Test Chrome and Firefox plus at least one lower-memory device for 500, 1,000 and 5,000 rows using small/simple and large/complex representative PDFs. Measure peak memory, UI responsiveness, row/chunk completion time, R2 upload recovery, resume after refresh, duplicate completion protection, and ZIP creation/download memory. Compare a bounded/streaming ZIP library against a simple approach; JSZip docs warn that `generateAsync` holds the full result in memory. Choose per-chunk archive size and concurrency only after these measurements.

### 24.4 Integration/fault-injection tests

- Browser closed at each generation stage; expired lease reclaimed; one uploaded file not duplicated after resume.
- R2 signed URL expires, is reused, has wrong content type, or is attempted against another object's key.
- MongoDB transient error, contention during claim, duplicate upsert, lost response after successful state write, and summary-counter drift.
- Email provider rate limit, daily quota exhausted, accepted response followed by Hono timeout, webhook duplicate/out-of-order, attachment size rejection, provider credentials missing, and sender domain not verified.
- Batch paused/canceled while items are claimed, between upload and finalize, and between intent and send response.
- Cleanup while job is active, object deletion failure, database record deletion before R2 deletion, and retention expiry while a send is unknown.

### 24.5 Minimum private-prototype release gate

Before testing with real recipients: keep sending disabled or tightly limited; only use a verified/approved sender and test inboxes; test auth ownership boundaries; verify R2 is private; validate source upload; prevent repeated dispatch on double click; establish basic rate limits and a global send kill switch; verify PII redaction; and ensure every job has a resumable status. Before public bulk-email launch, also require signed webhooks, bounce/complaint suppression, global/per-account quotas, abuse reporting, cleanup verification/retries, attachment-size policy, and the full fault-injection suite.

## 33. End-to-end acceptance criteria for the complete MVP

A release candidate is acceptable only when the following end-to-end journey succeeds:

1. A user signs in with Google; Hono verifies the token and creates an app session. The browser uses the same-origin `/api` path. Another account cannot access the user's resources.
2. The user uploads a supported text PDF directly to a private R2 object with an authorized short-lived URL. The template stores a checksum and version; PDF contents are not stored in MongoDB.
3. The user maps detected placeholders or visual regions, previews masking, and gets a clear rejection/warning for unsupported background/layout behavior.
4. The user imports CSV/XLSX, maps columns, sees normalized rows, missing values, invalid dates/numbers, duplicate addresses and likely overflow. Valid rows remain usable while invalid rows are individually blocked.
5. Re-import creates a diff. Stable unique matches are reconciled, ambiguous matches require manual review, and inline overrides are preserved or explicitly resolved.
6. The user browses every draft through the shared preview/final-generation pipeline, including long-name and boundary-value examples.
7. Approval creates one immutable snapshot. Changing a draft later cannot mutate that snapshot or its outputs.
8. The browser generates PDFs using bounded Worker chunks and direct R2 uploads. A tab close leaves completed work recorded; reopening the app resumes uncompleted work after lease recovery without duplicating authoritative outputs.
9. Pause/cancel stops new work at chunk boundaries. All completed files and prior send outcomes remain accurately recorded.
10. The user downloads a valid ZIP (or multiple bounded ZIP parts) and any authorized individual PDF. File names are deterministic, safe and mapped to the correct records.
11. If email is enabled, every sent message has one intended recipient and the matching recipient's PDF, is authorized by Hono, and obeys provider/global/account quotas. Detailed provider states are visible where supported.
12. Injected provider timeout after acceptance creates an `unknown` state and is reconciled rather than blindly resent. Retryable errors use bounded backoff; permanent errors are actionable; signed webhook events are deduplicated.
13. At retention deadline, unsent/unknown cases are surfaced to the organizer before cleanup. The chosen unresolved policy must define whether pending recipients become `expired_unsent`, use a separately disclosed delivery-retention window, or are blocked from creating batches that cannot fit the configured retention.
14. Cleanup works with the browser closed, at least through a verified scheduled sweep plus lifecycle backstop for the private prototype. Every deletion is idempotent, failures remain visible, and expired recipient PII is not retained in cleanup history.
15. The actual measured batch, bytes, page count, preview latency and ZIP memory usage are captured as benchmark results. Only measured capabilities become documented limits; no untested fixed completion-time promise is made.


---

<!-- Source file: 14_DECISION_REGISTER.md -->

# Authoritative Decision Register

**As of:** 10 October 2026. This register is authoritative for current status. Older source logs remain available for history.

## Status labels

- **USER-DECIDED:** Explicit choice by the user.
- **USER-PREFERENCE/TARGET:** Stated direction, with measurable details still open.
- **RECOMMENDATION:** Assistant proposal, not accepted unless the user explicitly accepted it.
- **TECHNICAL FACT (DATED):** Source-specific finding; re-check time-sensitive facts.
- **OPEN:** Not selected.
- **DEFERRED:** Intentionally not in current milestone.
- **CONFLICT/RISK:** Requirements interact in a way that requires explicit handling.

## Product scope and UX

| Item | Current status | Evidence/implication |
|---|---|---|
| General-purpose audience | USER-DECIDED | R1; long-term launch-niche recruitment remains open. |
| All document categories from launch | USER-DECIDED | R2; use-case breadth does not promise arbitrary PDF support. |
| Existing PDF is the starting point | USER-DECIDED | Initial brief; don't require recreating the design in app. |
| Automatic placeholder suggestions + visual fallback | USER-DECIDED | R1/R2; suggestion needs user confirmation. |
| First PDF compatibility | USER-DECIDED | Text-based PDFs with auto field suggestions; token detection + confirmed overlays; clean placeholder areas for unsupported background layouts. |
| OCR/image-only PDFs | DEFERRED/NOT COMMITTED | No universal arbitrary PDF or OCR promise. |
| Variable fields | USER-DECIDED | Text, dates, numbers. Image fields/signatures/photos are future possibilities only. |
| Data import | USER-DECIDED | CSV/XLSX with column mapping. Pasting and Google Sheets integration not selected. |
| Batch target | USER-PREFERENCE/TARGET | 500–5,000 records. Advertised maximum waits for benchmarks. |
| Review all drafts | USER-DECIDED | All individual drafts must be browseable before approval, preferably via searchable/paginated gallery and on-demand preview. |
| Invalid records | USER-DECIDED | Isolate affected rows; allow valid rows to continue. |
| Inline edits + re-import | USER-DECIDED | Both must work. Re-import creates a diff/reconciliation step. |
| Ambiguous row matching | USER-DECIDED | Manual reconciliation if no reliable unique key; don't silently match by row order/name/email. |
| Duplicates | USER-DECIDED | Warn and preserve; don't silently drop legitimate records. Prevent duplicate operation sends for same recipient-document revision. |
| Multi-page PDFs | USER-DECIDED | Capped multi-page support; cap comes from benchmarks. |
| Text overflow | USER-DECIDED | Fit-then-flag; no silent clipping. Exact font-size floor and wrap policy are implementation details/open. |
| Preview parity | USER-DECIDED | Same processing pipeline for preview and final output. |
| Approval data | USER-DECIDED | Immutable snapshot of effective records, overrides and template/mapping version. |
| Downloads | USER-DECIDED | ZIP of individual PDFs plus optional individual downloads; browser bounded, split if needed. |
| Template reuse | USER-DECIDED | Accounts, reusable templates and temporary job history. Source template PDF retained until template deletion. |
| Accounts | USER-DECIDED | Individual accounts only for MVP; team workspaces deferred. |
| Job control | USER-DECIDED | Pause/resume/cancel unsent work; completed generation/sends stay recorded. |
| Browser close | USER-DECIDED | Processing pauses and resumes when user returns. No autonomous work claim while browser is closed. |
| Progress | USER-DECIDED | Persisted accurate progress; no fixed completion-time promise before benchmarking. |
| Future editor | USER-PREFERENCE/DEFERRED | Lightweight Canva-like PDF editor is future direction, not first prototype. |
| Future extensions | USER-DECIDED PRIORITY | Delivery tracking and retries are first extension priority; email itself comes after downloads-first proof. |

## Architecture and tooling

| Item | Current status | Evidence/implication |
|---|---|---|
| Frontend | USER-DECIDED | React + Vite + TypeScript. |
| Backend | USER-DECIDED DIRECTION | Hono + TypeScript; selected by user's additional Round 6 note. |
| Repositories | USER-DECIDED | Separate web and API repos. Suggested repo labels are not approved names. |
| Hosting | USER-DECIDED FOR PRIVATE PROTOTYPE | Vercel Hobby for private non-commercial prototype only; public host remains open under strict $0. |
| Authentication | USER-DECIDED | Google Identity Services only. Backend token verification required. |
| App session | USER-DECIDED | HttpOnly cookie. |
| Browser/API topology | USER-DECIDED | Same-origin request arrangement despite separate source repos. Exact domain/proxy must be tested. |
| MongoDB | USER-DECIDED FOUNDATION | Durable metadata/state. Exact cluster/free eligibility and schema still need validation. |
| Queue | USER-DECIDED DIRECTION | MongoDB-backed queue. Queue needs explicit work dispatcher/claims/leases and cannot run itself. |
| Object store | USER-DECIDED CANDIDATE | Cloudflare R2, with hard usage caps. |
| PDF execution | USER-DECIDED | Browser/Web Worker chunks. |
| Progress transport | USER-DECIDED | Polling persistent state. |
| Validation | USER-DECIDED | Zod. |
| API contract | USER-DECIDED | OpenAPI between repos. Generator and client implementation still open. |
| Dev defaults | USER-DECIDED DEFAULT | Supported Node LTS, npm/lockfiles, Vitest, Playwright and GitHub Actions. |
| PDF libraries | RECOMMENDATION | PDF.js for inspection/rendering, pdf-lib for drawing/modification; test compatibility. |
| Provider/queue/object libs | OPEN/PROPOSED | Don't assume Resend, Brevo, Nodemailer, BullMQ/Redis or a ZIP library is final. |

## Privacy, retention, operational rules

| Item | Current status | Evidence/implication |
|---|---|---|
| Temporary job data | USER-DECIDED | User-configurable automatic deletion. |
| Presets | USER-DECIDED | 24 hours, 7 days, 30 days; 30-day maximum in MVP. |
| Template source retention | USER-DECIDED | Keep source until template is deleted; expire job files separately. |
| Post-expiry history | USER-DECIDED | Aggregate counts and timestamps only as the long-lived summary. |
| Timer semantics | USER-DECIDED | Completion-deadline (Round 8). Exact edge rules for abandoned drafts should be documented during implementation. |
| Expiry vs pending email | USER-DECIDED | Strict deadline: unsent files/rows expire; do not silently extend retention. Mark unsent work `expired_unsent`. |
| Physical deletion | USER-DECIDED OPERATION | Daily sweep under $0, direct deletions, cleanup ledger/retries, lifecycle backstop. Disclose actual physical deletion may lag. |
| Sensitivity | USER-DECIDED | Ordinary personal/business documents for MVP; no unsupported regulated-data compliance claims. |
| Operating budget | USER-DECIDED | Hard zero cost. If no compliant public deployment can work at $0, raise as a blocking conflict rather than silently adding paid services. |

## Email and launch

| Item | Current status | Evidence/implication |
|---|---|---|
| App-managed email | USER-DECIDED FUTURE FEATURE | One PDF attachment per recipient. |
| First prototype | USER-DECIDED | Downloads-first; no live email sending before core PDF/download flow passes. |
| Organizer mailbox integration | DEFERRED | Gmail/Outlook connection later. |
| Email quotas | USER-DECIDED | Free-capped. Queueing does not remove quota. |
| Throttle/retry behavior | USER-DECIDED | Auto-throttle, retry transient errors, expose permanent failures. |
| Delivery statuses | USER-DECIDED | Distinguish queued/sending/provider accepted/delivered/bounced/complained/failed/unknown as provider events support. |
| Ambiguous outcome | USER-DECIDED | Reconcile before retry; never blindly retry. |
| Retry attempts/backoff | RECOMMENDATION | Up to 5 attempts with exponential backoff/jitter was proposed; provider-specific error taxonomy still required. |
| Nodemailer | USER REQUEST TO INVESTIGATE | “Nodemailer or something” to improve sends. Not a selected dependency, service or quota bypass. |
| Email provider | OPEN | Compare providers later; Brevo is a research candidate, not selected. Resend is also not selected. |
| Registration | USER PREFERENCE | Open registration with minimal restrictions, guarded for sending. |
| Launch gate | USER-DECIDED | Private-first; security/recovery and quota tests before public bulk email. |

## Current recommendations, not accepted choices

- Focus user interviews on one launch segment while keeping the product architecture general-purpose.
- Use a paginated/searchable draft gallery and on-demand previews.
- Use an OpenAPI-generated frontend client, enforce CI drift checks.
- Direct upload/download with short-lived R2 signed URLs.
- Use a provider adapter and enable batch send only after unique attachment behavior is proven.
- Keep all live email disabled in the first prototype.
- Benchmark on representative browser/device/PDF fixtures; set published hard limits from measurements.
- Before public launch, add sending-specific verification, global/account/batch caps, bounce/complaint suppression, abuse reporting and a kill switch.

## Open questions

1. Final app name, tagline, logo, color palette, domain, tone, trademarks.
2. First audience segment to recruit for research.
3. Public host that is both eligible under terms and $0.
4. Max upload size, page count, rows, fields, concurrent jobs and archive size.
5. Provider, sender identity/domain, message attachments, quotas, webhook events and account eligibility.
6. Actual browser/device benchmark and ZIP library/strategy.
7. Cookie lifetime/rotation/CSRF specifics and exact DNS/proxy deployment.
8. OpenAPI generator/client tooling.
9. Exact cleanup failure UX and abandoned-draft timer details.
10. Future public verification/QR IDs, corrections/reissue, editor, teams, Google Sheets/API integrations.
11. Acquisition channels, success metrics, product analytics and future monetization.

## Contradictions / feasibility risks

- Strict deadline + retention presets vs free provider quota: 5,000 messages can take 17–50+ days under current example free quotas, longer than retention; preflight feasibility check and `expired_unsent` are required.
- Browser processing + “background”: work pauses when browser closes; don't market it as autonomous.
- Vercel Hobby + public/monetized product: public hosting eligibility is unresolved.
- Any document category vs PDF compatibility: scope is broad by category, constrained by file/layout.
- Nodemailer concurrency vs provider quota: cannot create additional allowance.
- Hard $0 vs reliable autonomous queue: if constraints conflict, explicitly ask to revisit instead of silently violating them.


---

<!-- Source file: 15_RESEARCH_REGISTER_AND_REFERENCES.md -->

# Research Register and References

## 9. Current public technical references

Links were checked during discovery on 10 October 2026. Pricing, quotas and product terms may change; re-check before implementation.

- PDF.js project: https://github.com/mozilla/pdf.js
- `pdf-lib` features and documented limitations: https://github.com/Hopding/pdf-lib
- BullMQ idempotent jobs: https://docs.bullmq.io/patterns/idempotent-jobs
- BullMQ retries: https://docs.bullmq.io/guide/retrying-failing-jobs
- BullMQ rate limiting: https://docs.bullmq.io/guide/rate-limiting
- MongoDB TTL indexes and delayed expiration behavior: https://www.mongodb.com/docs/v8.0/core/index-ttl/
- Render free service constraints: https://render.com/docs/free
- Render FAQ on ephemeral filesystems: https://render.com/docs/faq
- MongoDB Atlas pricing/free tier: https://www.mongodb.com/pricing
- Upstash Redis pricing: https://upstash.com/pricing/redis
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Resend pricing: https://resend.com/pricing
- Amazon SES sending quotas: https://docs.aws.amazon.com/ses/latest/dg/manage-sending-quotas.html
- Amazon SES attachment limits: https://docs.aws.amazon.com/ses/latest/dg/attachments.html
- OWASP file-upload risks: https://owasp.org/www-community/attacks/Unrestricted_File_Upload

### 11.4 Current provider constraints verified on 10 October 2026

- **Render Free:** official documentation says free services are for exploration/testing, web services sleep after 15 minutes without inbound traffic, local changes are lost because the filesystem is ephemeral, the free Key Value service is in-memory and loses data on restart, and outbound SMTP ports 25, 465 and 587 are blocked. Avoid relying on a sleeping free instance as the sole always-on worker or on local disk as durable storage. API-based email providers use HTTPS and are a more suitable connection pattern on this host, but worker reliability remains a separate concern. Source: https://render.com/docs/free
- **Resend Free:** pricing currently lists 3,000 emails/month with a 100-email/day limit. A 5,000-recipient batch would need at least 50 sending days if the account is subject to this daily limit, ignoring other quota and deliverability considerations. Source: https://resend.com/pricing
- **Amazon SES sandbox:** new accounts are restricted to verified recipients, up to 200 messages per 24 hours and a sending rate of one message per second. Production access and larger quotas are not automatic assumptions; sandbox constraints are per AWS Region. Source: https://docs.aws.amazon.com/ses/latest/dg/manage-sending-quotas.html
- **Amazon SES message size:** SES v2 documents a maximum 40 MB total message size including attachments after Base64 encoding; the SES v1 API maximum is 10 MB including attachments after encoding. Email attachments expand during Base64 encoding, so PDF file size alone is not the correct envelope size. Source: https://docs.aws.amazon.com/ses/latest/dg/quotas.html
- **Cloudflare R2:** standard storage pricing currently includes 10 GB-month storage, 1 million Class A operations, 10 million Class B operations and free internet egress. This is a plausible object-storage candidate, not yet a provider decision; confirm S3-compatible SDK behavior, access-control model, account terms and lifecycle deletion in a prototype. Source: https://developers.cloudflare.com/r2/pricing/
- **MongoDB TTL:** TTL indexes delete eligible documents asynchronously and do not guarantee immediate deletion at the expiry instant. They are useful as a safety net, but not sufficient to promise an exact deletion time. Source: https://www.mongodb.com/docs/manual/core/index-ttl/
- **BullMQ:** retries support fixed or exponential backoff and jitter; rate limiting is global for a queue, which is useful for provider quotas. Retryable jobs must be designed to be idempotent. These queue features do not make external email delivery exactly-once. Sources: https://docs.bullmq.io/guide/retrying-failing-jobs, https://docs.bullmq.io/guide/rate-limiting, https://docs.bullmq.io/patterns/idempotent-jobs
- **PDF.js:** current API documentation exposes page/text-content APIs useful for extraction and locating candidate token ranges, but extraction is not a guarantee that arbitrary PDF text can be replaced safely. Source: https://mozilla.github.io/pdf.js/api/
- **File upload security:** OWASP recommends allowlisting types, validating actual content rather than trusting the MIME header, setting size limits, storing files away from the web root, applying authorization and considering malware scanning/sandboxing. PDFs and XLSX files must be handled as untrusted input. Source: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html

These limits were checked on 10 October 2026. Pricing, free tiers, quotas and provider terms can change; reconfirm before implementation and before public launch.

## 26. Technical references consulted by v0.7 (10 October 2026)

- Google ID token verification: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token — verify signature, audience, issuer and expiry; use `sub` as the stable account identifier. (Google official docs.)
- MongoDB atomicity: https://www.mongodb.com/docs/manual/core/write-operations-atomicity/ — single-document writes are atomic; multi-document writes require careful design/transactions when cross-document atomicity is needed.
- MongoDB `findOneAndUpdate`: https://www.mongodb.com/docs/manual/reference/method/db.collection.findoneandupdate/ — suitable building block for atomic conditional claims/leases, with filter and update semantics to be tested in the actual driver.
- MongoDB Atlas Free limits: https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/ and https://www.mongodb.com/docs/atlas/reference/faq/storage/ — free cluster has a hard storage limit and tier-specific capability/connection limits; benchmark footprint and indexes.
- Vercel Hobby terms: https://vercel.com/legal/terms and https://vercel.com/docs/plans/hobby — Hobby is limited to personal or non-commercial use. This is an unresolved hosting eligibility constraint for public/general-purpose launch.
- Vercel function limits: https://vercel.com/docs/functions/limitations and https://vercel.com/docs/limits — bounded, resumable function work; verify current runtime duration/payload limits for the selected plan at deployment time.
- Cloudflare R2 presigned URLs: https://developers.cloudflare.com/r2/api/s3/presigned-urls/ — signed URLs can grant temporary access to one operation/object and remain reusable until expiration; the docs list expiries from one second to seven days and recommend appropriate CORS.
- Cloudflare R2 CORS: https://developers.cloudflare.com/r2/buckets/cors/ — configure browser origin, method and header permissions explicitly.
- Cloudflare R2 object lifecycles: https://developers.cloudflare.com/r2/buckets/object-lifecycles/ — objects are typically removed within 24 hours after their expiration value; this supports a lifecycle backstop but not exact-time erasure guarantees.
- Resend idempotency keys: https://resend.com/changelog/idempotency-keys — documented provider-side idempotency retention is 24 hours; application-level state remains necessary.
- JSZip limitations: https://stuk.github.io/jszip/documentation/limitations.html — `generateAsync` holds the full result in memory; this supports benchmarking/splitting and investigating a streaming ZIP approach.
- PDF.js API: https://mozilla.github.io/pdf.js/api/ — text content includes fragments, transforms, dimensions and styles; extraction does not imply arbitrary PDF text can always be safely replaced.
- OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html — validate actual file content, allowlist types, impose size limits, authorize access, use safe storage and consider hostile files.

**Change-control rule:** v0.7 is a working specification. The user choices in Sections 15 and 17 are confirmed; all schema/route drafts, quota numbers, provider selection, numeric workload limits and exact deletion timing remain proposals until approved and tested.


---

# Version 0.8 — Round 8 decisions and implementation plan

> **Authority rule:** This section is the latest authoritative record for Round 8. Earlier round prompts and tables remain as historical context. Where older sections say an item is open, use the later status below. User selections are identified as **Confirmed choice**; engineering proposals are **Recommendation**; provider facts are **Verified constraint**. Do not silently upgrade a recommendation into a user decision.

**Version:** 0.8  
**Updated:** 10 October 2026  
**Discovery status:** Rounds 1–8 captured. Product architecture is sufficiently defined to start feasibility spikes and development planning. Provider selection, a retention-versus-email conflict, numeric limits, and public launch hosting remain open.

## 29. Provider and platform facts checked for v0.8 — 10 October 2026

| Provider/component | Verified current finding | Implication for this project |
|---|---|---|
| Vercel Hobby | Terms limit Hobby services to personal or non-commercial use. | Acceptable for a private prototype if that exact use qualifies; not a plan for the public general-purpose product. Public hosting remains open under the $0 budget. |
| Hono on Vercel | Hono documents zero-configuration deployment on Vercel. | Technical feasibility is not the same as plan eligibility or autonomous worker availability. |
| Vercel rewrites | Can proxy external-origin paths without changing the browser-visible URL. | Supports same-origin `/api/*` with separate repos; validate cookie/header semantics end to end. |
| Vercel Functions | Request/response payload size currently documented as 4.5 MB; durations are bounded by plan/runtime settings. | Upload files directly to R2 and dispatch bounded units; do not send whole source/output PDFs via API bodies. |
| Vercel Hobby Cron | Current Hobby scheduling is daily (within platform scheduling precision); failed cron invocations are not automatically retried. | Use as a cleanup backstop only; make the sweep idempotent and alert/record failures. A daily scheduler is not a durable high-frequency job queue. |
| Cloudflare R2 | Standard free allowance currently lists 10 GB-month storage, 1 million Class A requests, 10 million Class B requests and free internet egress; excess usage can be billed. | Use quotas and pre-upload checks. Do not treat the free allowance as unlimited. |
| MongoDB Atlas Free | Current Atlas docs identify a 512 MB hard storage ceiling for Free clusters, limited resource/capability access and no automatic storage overrun. | Keep PDFs out of MongoDB; store metadata and only the minimum row/history data required. Add quota monitoring/early rejection. |
| Resend Free | 3,000 emails/month and 100/day; provider-side idempotency-key retention is 24 hours. | Useful comparison candidate, but too slow for large batches and 24h provider idempotency does not replace long-lived app state. |
| Brevo Free | 300 emails/day on the Free plan; unused daily quota does not roll over. Transactional API accepts PDF attachments via URL or base64, and webhooks expose delivery and bounce/spam outcomes. | Stronger daily allowance among candidates found, but a 5,000-message batch still takes at least 17 days at the cap; test account policy, sender verification, attachment limits, signatures and free-tier eligibility. |
| Amazon SES | As of the 21 July 2026 SES pricing change, the older SES-specific 3,000 message-charge free tier is no longer available to new SES users; the Essentials plan prices email by volume. New accounts begin in a sandbox until production access is granted. | Not a permanent strict-zero candidate absent applicable credits or other verified terms; keep it in the comparison for technical/deliverability evaluation only. |
| Google Identity Services | Google says the ID token must be verified server-side, including signature, audience, issuer and expiry; use `sub` as the stable identity key. | Never trust a plain browser-supplied user ID/email. Create the app session only after token verification. |

Official sources: [Vercel Terms](https://vercel.com/legal/terms), [Vercel Hono](https://vercel.com/docs/frameworks/backend/hono), [Vercel rewrites](https://vercel.com/docs/routing/rewrites), [Vercel function limits](https://vercel.com/docs/functions/limitations), [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [R2 lifecycle rules](https://developers.cloudflare.com/r2/buckets/object-lifecycles/), [Atlas Free cluster limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/), [Atlas storage FAQ](https://www.mongodb.com/docs/atlas/reference/faq/storage/), [Resend pricing](https://resend.com/pricing), [Resend idempotency](https://resend.com/changelog/idempotency-keys), [Brevo plans](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans), [Brevo transactional API](https://developers.brevo.com/docs/send-a-transactional-email), [Brevo webhooks](https://developers.brevo.com/docs/transactional-webhooks), [AWS SES pricing](https://aws.amazon.com/ses/pricing/), [AWS SES pricing-plan announcement](https://aws.amazon.com/blogs/messaging-and-targeting/introducing-amazon-simple-email-service-ses-pricing-plans/), [Google ID token verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

## 39. Sources checked for Round 9

- Nodemailer transport types and SMTP: https://nodemailer.com/transports ; https://nodemailer.com/smtp
- Brevo free plan: https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans
- Brevo free quota FAQ: https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan
- Brevo batch transactional API: https://developers.brevo.com/docs/batch-send-transactional-emails
- Brevo single transactional API/attachments: https://developers.brevo.com/reference/send-transac-email
- Brevo SMTP relay: https://developers.brevo.com/docs/smtp-integration
- Resend current pricing: https://resend.com/pricing
- Vercel Terms (Hobby restrictions): https://vercel.com/legal/terms
- Google ID token verification for backend: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token

Checked: 10 October 2026. Recheck provider pricing, limits, terms and API behavior before implementation and launch.

## Market and provider pages rechecked while assembling v1.0 (10 October 2026)

- Canva Bulk Create official help (auto-match, manual mapping and current listed selection cap): https://www.canva.com/help/bulk-create/
- Certifier current feature page: https://certifier.io/features
- Certifier bulk generator page: https://certifier.io/features/generator
- Certifier plan documentation: https://support.certifier.io/en/articles/10806136-guide-to-certifier-plans
- Accredible API docs: https://docs.api.accredible.com/
- Cgenerate open-source project information: https://github.com/cgenerate/cgenerate
- MailMyCertificate site/FAQ: https://www.mailmycertificate.tech/
- Give My Certificate user reviews (anecdotal source, not representative study): https://www.g2.com/products/give-my-certificate/reviews
- Brevo batch transactional API: https://developers.brevo.com/docs/batch-send-transactional-emails
- Brevo send transactional email API reference (attachment field and messageVersions schema): https://developers.brevo.com/reference/send-transac-email
- Brevo pricing plans: https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans
- Resend current pricing: https://resend.com/pricing
- Nodemailer pooled SMTP documentation: https://nodemailer.com/smtp/pooled
- Vercel terms: https://vercel.com/legal/terms
- Vercel function payload limitations: https://vercel.com/docs/functions/limitations
- R2 object lifecycle behavior: https://developers.cloudflare.com/r2/buckets/object-lifecycles/

### Additional implications

- A dedicated browser tool such as Cgenerate already supports CSV/XLSX-based bulk certificates, validation, visual name placement and ZIP output; MailMyCertificate advertises local browser execution and Gmail sending. So browser processing and free generation are not unique differentiation on their own.
- Certifier and Accredible already cover bulk credential issuance, management and verification. The product should avoid claims that these functions do not exist elsewhere.
- Brevo batch API supports up to 1,000 personalized message versions per request, but per-version distinct PDF attachments are not documented in the override list. Must test before relying on batching for one unique PDF per recipient.
- Nodemailer pooling improves SMTP connection reuse; it does not expand the provider/account quota.


---

<!-- Source file: 16_ASSUMPTIONS_RISKS_DEPENDENCIES_AND_OPEN_ITEMS.md -->

# Assumptions, Risks, Dependencies and Open Items

## Assumptions currently being used for planning

1. Many intended users already have a PDF design they wish to preserve rather than recreate in a new editor.
2. For supported PDFs, text extraction and overlays can be made visually reliable enough with user confirmation.
3. Browser processing can support an agreed portion of 500–5,000-record batches with bounded chunks and careful memory management.
4. R2 can support early private prototype volumes within free quotas if caps are enforced.
5. Browser-driven generation is acceptable even though it pauses when the browser closes.
6. A paginated/on-demand gallery can let an organizer inspect every draft without opening every final PDF manually.
7. Free-capped email is useful despite potential delivery delay, but user tolerance for 17–50+ day large-batch delivery has not been validated.
8. Public registration can coexist with guardrails and verified sending entitlement.
9. General-purpose means document categories, not arbitrary file layouts or regulated use cases.

None of these assumptions should become a public claim without customer validation, source verification or benchmarks.

## High-priority risks

| Risk | Severity | Why it matters | Mitigation / evidence needed |
|---|---|---|---|
| Some PDFs cannot be safely text-replaced | High | PDF layout often lacks semantic text boxes; mask may destroy design | Compatibility boundary, clean-field requirement, preview and safe rejection |
| Browser memory exhaustion | High | Thousands of generated PDFs and ZIP bytes can accumulate | Web Worker chunks, incremental R2 uploads, bounded/split ZIP, browser benchmarks |
| Browser closes mid-job | High | Browser compute halts | Persist checkpoints; resume/reconcile on return; no autonomous-work claim |
| MongoDB queue has no independent consumer | High | Database job records do not run themselves | Explicit browser dispatcher/claim protocol; independent worker is not in current design |
| Public hosting may not fit $0 | High | Vercel Hobby is personal/non-commercial | Private prototype only; solve eligible public hosting before beta |
| Provider quota too small | High | 5,000 sends take 17–50+ days under current example free tiers | Downloads-first, delivery/retention preflight, transparent limits |
| Strict expiry occurs before send | High | A queued recipient may lose its output before send | Strict deadline and `expired_unsent`; don't silently extend retention |
| Duplicate/unknown send | High | A timeout after provider acceptance can lead to duplicate emails | Stable application send key, provider IDs/events, reconciliation before retry |
| Deletion delay | High | MongoDB TTL and R2 lifecycle are asynchronous | Daily sweep, direct deletes, ledger, retry, transparent copy |
| Exposed client secret | High | Vite `VITE_*` values are bundled publicly | Server-only secrets, CI secret scanning, no direct DB from browser |
| Abuse/sender reputation | High | Public registration with bulk email can be abused | Email-send verification gate, quotas, suppression, abuse reporting, kill switch |
| Cross-user leakage | High | PDFs contain personal data | Object-level authorization, private buckets, scoped URLs, penetration tests |
| Brand collision | Medium | No name/availability check | Name/domain/trademark screening before launch |
| Competitors already offer similar features | Medium/High | Bulk generation/browser processing/free workflows exist | Hands-on comparison and interviews; differentiate on workflow/reliability only if validated |

## Conflicts that must not be silently resolved

### Strict zero cost vs autonomous, reliable execution
A free/serverless prototype can support bounded interactive jobs, but that is not equivalent to a continuously running worker. The chosen model pauses when the browser closes. If future requirements require autonomous processing, infrastructure/budget may have to change; request an explicit decision rather than assuming paid services.

### Strict expiry vs free email quotas
The user selected strict output deadlines and retention presets of 24 hours, 7 days and 30 days. Current free provider examples are much slower for 5,000 messages. Before dispatch, estimate whether the run can finish within retention. Pending sends expire as `expired_unsent`; files are not retained silently.

### Any category vs supported PDF layouts
The category list is broad but formats/layouts are constrained. Scanned PDFs/OCR, universal in-place editing and arbitrary masking are not MVP promises.

### Unique attachment per recipient vs batch API
A batch API may accept many recipient versions but not document a distinct attachment override for each. Prove capability before use; otherwise send one message per recipient under controlled concurrency.

### Nodemailer vs quota
Nodemailer can reduce connection overhead with pooled SMTP connections. It cannot raise provider/account quota, sender trust or deliverability guarantees.

### User-configurable deletion vs exact physical removal
The product can enforce deadlines and directly request deletion, but infrastructure deletion is asynchronous. Do not promise instantaneous physical erasure at the exact deadline.

## Dependencies to clear early

- Google Identity client configuration and backend token verification.
- Same-origin deployment routing and cookie/CSRF flow.
- Private R2 bucket, CORS configuration (only as required), signed upload/download flow and direct deletion.
- MongoDB connection, indexes, atomic claims/leases and state invariants.
- PDF fixture bank representing supported and unsupported layouts.
- OpenAPI generation and frontend client generation.
- A browser chunk-dispatch protocol that prevents two tabs from producing conflicting outputs.
- An eligibility-approved public host under strict $0 before public beta.
- Provider, sender configuration, attachment proof-of-concept and webhook signature handling before live email.

## Open items by milestone

### Before the first vertical slice
- Confirm local and preview same-origin `/api` setup.
- Choose the minimal Hono/OpenAPI generation package.
- Define session lifetime/rotation, CSRF and cookie attributes.
- Configure R2 private access, short-lived signed upload/download URLs and hard storage caps.
- Create PDF fixtures and supported/unsupported rules.

### Before generation MVP
- Freeze exact MongoDB schemas/indexes and concurrency/lease behavior.
- Define row IDs, overrides, snapshots/checksums and reconciliation algorithm.
- Define cancellation behavior for already-created objects under the retention deadline.
- Benchmark multi-page previews, worker chunk sizes and ZIP strategy.

### Before email
- Compare Brevo/Resend/other current providers and account eligibility.
- Prove different PDF attachments can only be sent to the correct recipients.
- Define quotas, sender verification, acceptable use and complaint/bounce suppression.
- Verify webhook signatures, retryable vs permanent error classification and ambiguity reconciliation.
- Test strict expiry while sends are pending.

### Before public beta
- Find an eligible $0 host or explicitly revisit the zero-budget constraint.
- Pass cross-account/security, upload parsing, cleanup and recovery tests.
- Write privacy/deletion/acceptable-use disclosures consistent with behavior.
- Finalize name/domain/logo and public claims after availability checks.

## Market/product assumptions to validate

- How often initial users need 500–5,000 documents rather than tens/hundreds.
- Whether users have existing PDFs, or prefer to design within Canva/certificate apps.
- Whether users accept browser-paused work and confirm visual masks.
- Which step consumes the most time: creation, data cleanup, review, delivery, corrections or verification.
- Whether free-paced email is tolerable, or downloads satisfy most free users.
- Whether reusable templates and repeated issuance drive retention.
- Which initial segment and acquisition channel will produce active repeat usage.


---

<!-- Source file: 17_CONVERSATION_ARCHIVE_GUIDE.md -->

# Conversation Archive Guide and Provenance

## Records included in the project pack

- The initial product concept and user requirements, summarized in `04_DISCOVERY_HISTORY_AND_INTERVIEW_RECORD.md`.
- Exact selected values for every structured interview Round 1–9, with the question domains and major alternatives considered.
- The authoritative current decision table in `14_DECISION_REGISTER.md`.
- The full authored v0.9 snapshot in `SOURCE_V0.9_FULL.md`.
- All earlier decision log files v0.3 through v0.9 copied unmodified in `source-logs/`.
- Specialized product, PDF, architecture, data/state, email, security, hosting, roadmap, test, risk, research and brand files.
- `20_CONVERSATION_ARCHIVE_AND_PROVENANCE.md`: exact stored user answer blocks, assistant response/research map, and crosswalk to all supporting project records.

## How to interpret the chronology

The versioned decision logs are snapshots; early logs intentionally contain questions that were unresolved at that time. A later explicit user answer supersedes the earlier “open” status. The v1.0 top-level register is the current synthesis; source logs remain unchanged to preserve the evolution and reasoning trail.

The discovery was conducted through interactive answer forms. The interview record preserves product-relevant initial brief, question categories/alternative choices, exact user-selected answer values, later clarifications, and reasoning. It is not a byte-for-byte export of every UI render, search output or tool payload. The provenance archive states this explicitly; historical decision logs and topical files preserve the product-relevant assistant analysis. Where a verbatim assistant sentence was not captured separately, this pack does not fabricate one.

## Research provenance

Sources are linked directly in `15_RESEARCH_REGISTER_AND_REFERENCES.md`. Pricing, quotas and plan terms were observed during discovery and rechecked while assembling this pack on 10 October 2026. They can change and must be checked again before implementation and launch. Product pages are marketing sources; one review does not establish a widespread problem. No formal customer interviews, survey, willingness-to-pay study, trademark check or load test had been completed by this point.

## Brand provenance

The user requested brand details, but no final name/tagline/logo/palette/domain was selected in the interview. `03_BRAND_IDENTITY_AND_POSITIONING.md` therefore records the current descriptive codename and clearly flags all new names/taglines as unapproved ideas.


---

<!-- Source file: 18_ROUND_BY_ROUND_DECISION_TIMELINE.md -->

# Round-by-Round Decision Timeline

The full interview answers are in `04_DISCOVERY_HISTORY_AND_INTERVIEW_RECORD.md`; detailed authored reasoning is retained in `source-logs/`.

| Round | User-selected values | Main consequence |
|---|---|---|
| Initial brief | Existing PDF + data list; unique docs; download/email; queued errors/retries; future lightweight editor; TypeScript/Node/MongoDB | Need robust PDF compatibility, generation, delivery, lifecycle and error handling. |
| 1 | General-purpose users; auto placeholder detection + visual fallback; confirm detection; 500–5,000; email undecided; temporary storage; simplest existing-PDF workflow; free initially | Broad product vision with a constrained, benchmarked PDF core. |
| 2 | All document categories; text PDFs with suggestions; confirmed overlays; text/date/number; CSV/XLSX; browse every draft; app-managed individual attachments; configurable deletion; reusable templates/accounts; delivery retries priority | Review gallery, template reuse and separate output/delivery states. |
| 3 | Browse all drafts; isolate invalid rows; automatic throttle/retry transient; organizer mailbox later; clean placeholder fields for unsupported backgrounds; retain template PDF until deletion; ZIP+individual; individual accounts; pause/resume/cancel unsent | Row isolation, cancellation semantics, template/job retention separation. |
| 4 | Most choices undecided; asynchronous progress/no fixed completion promise; open registration with minimal restrictions | Persistent status and safeguards needed; no SLA claims. |
| 5 | Google-only; inline edits + re-import; capped multipage; fit-then-flag; benchmark limits; aggregate history; ordinary document sensitivity; strict $0; free-capped email; public-guarded registration | Zero-cost constraint affects service topology; error and safety behavior matters. |
| 6 | React/Vite; backend initially undecided; separate repos; Google Identity; browser PDF; MongoDB queue; R2; serverless chunks; polling; Zod; later clarified Hono on Vercel and frontend-orchestrated PDF/email | Browser is the compute orchestrator; server secrets stay in Hono; Vercel only private prototype. |
| 7 | Pause/resume; frontend-Hono email orchestration; HttpOnly cookie; immutable snapshot; diff/reconcile; warn/preserve duplicate; detailed email states; reconcile unknown before retry; bounded retry; 24h/7d/30d; browser-bounded ZIP; strict secret boundary; private-first | Snapshot hashes, leases/checkpoints, per-recipient state, cleanup ledger and fault testing. |
| 8 | Vercel private prototype; same-origin cookie topology; compare providers; manual matching when uncertain; completion-deadline; same-pipeline preview; benchmark-before-promise | Public host remains open; retention/quota conflict needs explicit rule. |
| 9 | Strict output deadline; downloads-first; daily cleanup sweep; OpenAPI; Node LTS/npm/Vitest/Playwright/GitHub Actions; use Nodemailer or similar to improve email sending efficiency | Live email postponed; strict expiry; provider batching/connection reuse is not quota bypass. |

## Decisions that evolved

- Email was initially undecided, then selected as an eventual app-managed attachment workflow, but the first prototype was explicitly set to downloads-first.
- Backend was initially undecided and then clarified as Hono on Vercel for the private prototype; a compliant public host remains open.
- Architecture options discussed BullMQ/Redis and server workers, but the user selected a browser execution model and MongoDB queue direction. No continuously running worker is implied.
- The user requested Nodemailer or similar; this is a preference to investigate, not a selected provider or final package.
- The product remains general-purpose in categories, but first audience/recruitment niche is undecided.
- Branding was not yet decided at the end of the interview.

## Product invariants

1. Start from the user’s existing PDF.
2. Suggest fields; the user's confirmation is authoritative.
3. Fail safely on unsupported layouts.
4. Browse every draft before approval.
5. Freeze the approved version.
6. Process valid rows even if other rows are invalid.
7. Preserve duplicate records but avoid duplicate operation sends.
8. Each recipient gets only their own document.
9. Closing the browser pauses compute.
10. Downloads work independently of email availability.
11. Provider acceptance is not the same as inbox delivery.
12. Unknown sends are reconciled before retry.
13. Strict expiry stops unsent work; retention is not silently extended.
14. Nodemailer/batching does not bypass quotas.
15. Secrets remain server-side.
16. Public launch needs eligible hosting, abuse control and test gates.
17. App name/tagline are not chosen.


---

<!-- Source file: 19_CHANGELOG_AND_VERSION_POLICY.md -->

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


---

<!-- Source file: 20_CONVERSATION_ARCHIVE_AND_PROVENANCE.md -->

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


---

<!-- Source file: 21_ARCHIVE_MANIFEST_AND_COMPLETENESS.md -->

# Archive Manifest and Completeness Check

**Pack:** Bulk Document Issuance Project Documentation v1.0  
**Assembled:** 10 October 2026  
**Purpose:** Show what is covered, where to find it, and what the archive does/does not claim to preserve.

## 1. Coverage map

| Data class | Coverage | Canonical file(s) |
|---|---|---|
| Initial user concept and constraints | Initial brief preserved verbatim; requirements organized into sections | `04_DISCOVERY_HISTORY_AND_INTERVIEW_RECORD.md`, `05_PRODUCT_REQUIREMENTS_AND_WORKFLOWS.md` |
| Round 1–9 user answer values | Exact selected values captured; Round 6 follow-up clarification recorded | `04_DISCOVERY_HISTORY_AND_INTERVIEW_RECORD.md`, `20_CONVERSATION_ARCHIVE_AND_PROVENANCE.md` |
| Assistant discovery reasoning and recommendations | Organized by product, market, PDF, architecture, delivery, security and roadmap | `01_EXECUTIVE_DOSSIER.md`, `02`–`13`, `15`, `16`, `20` |
| Historical decision-log evolution | v0.3 to v0.9 source snapshots copied unchanged | `source-logs/` |
| Full v0.9 authored specification | Complete source copy | `SOURCE_V0.9_FULL.md` |
| Product scope and feature requirements | Organized functional and non-functional requirements | `05_PRODUCT_REQUIREMENTS_AND_WORKFLOWS.md` |
| Market/competitor research | Product categories, competitor notes, hypotheses, links and confidence labels | `02_MARKET_RESEARCH_AND_COMPETITIVE_LANDSCAPE.md`, `15_RESEARCH_REGISTER_AND_REFERENCES.md` |
| Brand | Codename, positioning, tagline/name candidates, voice/visual suggestions, explicit unapproved status | `03_BRAND_IDENTITY_AND_POSITIONING.md` |
| PDF compatibility and processing | Limits, overlay reasoning, preview/generation consistency and fixture tests | `06_PDF_ENGINE_AND_RENDERING_SPEC.md` |
| Architecture | Current user choices and remaining execution/deployment constraints | `07_SYSTEM_ARCHITECTURE.md` |
| Data/API/state | Proposed schemas, indexes, endpoints and transition rules | `08_DATA_MODEL_API_AND_STATE_MACHINES.md` |
| Email/Nodemailer/provider reasoning | Provider options, throughput arithmetic, attempts/reconciliation, strict expiry | `09_EMAIL_DELIVERY_AND_PROVIDER_STRATEGY.md` |
| Security/privacy/retention | Authentication, upload boundaries, authorization, data minimization, cleanup | `10_SECURITY_PRIVACY_AND_RETENTION.md` |
| Infrastructure and zero-cost feasibility | Hosting/service constraints, storage, queues and open public-host issue | `11_HOSTING_STORAGE_AND_ZERO_COST_CONSTRAINTS.md` |
| Repositories, CI/CD, environment, milestones | Proposed build sequence and acceptance gates | `12_ROADMAP_REPOSITORIES_CICD_AND_ENVIRONMENT.md` |
| Test scenarios | Unit/integration/E2E/security/fault scenarios and release gates | `13_TEST_MATRIX_AND_ACCEPTANCE_CRITERIA.md` |
| User decisions versus recommendations | Current, authoritative status | `14_DECISION_REGISTER.md` |
| Assumptions, risks and open decisions | Explicit uncertainty register | `16_ASSUMPTIONS_RISKS_DEPENDENCIES_AND_OPEN_ITEMS.md` |
| Conversation provenance | Round map, exact user answer blocks and response map | `20_CONVERSATION_ARCHIVE_AND_PROVENANCE.md` |

## 2. Historical snapshots preserved

The seven source logs included are:

- `source-logs/document-automation-decision-log-v0.3.md`
- `source-logs/document-automation-decision-log-v0.4.md`
- `source-logs/document-automation-decision-log-v0.5.md`
- `source-logs/document-automation-decision-log-v0.6.md`
- `source-logs/document-automation-decision-log-v0.7.md`
- `source-logs/document-automation-decision-log-v0.8.md`
- `source-logs/document-automation-decision-log-v0.9.md`

Each is preserved unchanged relative to the source file captured during assembly. A newer record can supersede an old choice; older files must not be rewritten to make their historical state look current.

## 3. Known coverage limitations

- The original user brief and all round answer values are preserved. The discovery archive is a structured project-relevant transcript, not a raw byte-level export of every chat interface rendering or tool invocation.
- Dynamic UI citation identifiers and hidden tool payloads are not portable as project sources. Portable URLs are recorded in `15_RESEARCH_REGISTER_AND_REFERENCES.md` and relevant technical files.
- Market research was desk research, not a representative market survey. It does not prove that a stated feature gap is common or that users will pay.
- Technical limits and pricing are dated research snapshots. Recheck them before implementation/deployment and public launch.
- App name, tagline, logo, palette, font system, final domain and trademark status have not been approved. Exploratory candidates are explicitly marked unapproved.
- No load test, browser memory benchmark, full provider attachment test, security penetration test, public deployment eligibility confirmation or customer interview study had been completed as of this documentation snapshot.

## 4. Completeness quality checks performed

- Required topical sections and source log files are present.
- Round answers, initial brief and current user-request intent are discoverable through the index and archive.
- Current architecture file reflects React/Vite, Hono, browser execution, MongoDB queue direction, R2, polling, Zod and separate repositories, rather than historical candidate defaults.
- Checked project files for unresolved auto-extraction markers such as “Missing section”.
- Duplicate copy of the preliminary workflow was removed from product requirements.
- Research caveats and unapproved brand status remain explicit.

## 5. How to use the archive going forward

Start with `00_README_AND_INDEX.md`, then `01_EXECUTIVE_DOSSIER.md` and `14_DECISION_REGISTER.md`. For implementation, use files 05–13. Before changing scope, check `16_ASSUMPTIONS_RISKS_DEPENDENCIES_AND_OPEN_ITEMS.md`; before citing competitive or technical claims, check file 15. Record the next decision in a new decision-log version and update all affected topical documents. Never treat this manifest, an assistant recommendation, or a historic candidate as a user-approved decision.
