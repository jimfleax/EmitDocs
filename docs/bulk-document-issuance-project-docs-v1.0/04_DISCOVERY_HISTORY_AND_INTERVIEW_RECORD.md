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
