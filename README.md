# EmitDocs

> **Document Automation · Bulk Issuance**  
> *One template. Every recipient. Ready to go.*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4%2B-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-61dafb.svg)](https://react.dev/)
[![Hono](https://img.shields.io/badge/Hono-4.4-E36002.svg)](https://hono.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.7%2B-47A248.svg)](https://www.mongodb.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-38B2AC.svg)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF.svg)](https://vitejs.dev/)
[![PWA](https://img.shields.io/badge/PWA-Ready-purple.svg)](https://web.dev/progressive-web-apps/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Documentation](https://img.shields.io/badge/Documentation-Complete-2563eb.svg)](docs/EMITDOCS_MASTER_SYSTEM_ARCHITECTURE.md)

EmitDocs is a bulk document personalization and issuance platform. It takes existing text-based PDF designs and tabular datasets (CSV/XLSX), assists organizers in visually mapping placeholders or layout regions on an interactive canvas, provides a searchable draft review gallery with inline CAS error correction and 4-way re-import reconciliation, seals approved datasets into immutable snapshots with canonical SHA-256 digests, generates individualized PDFs and streaming multi-volume ZIP archives entirely client-side via dedicated Web Workers and the FileSystem Access API, and distributes certificates directly to participants through a self-service, rate-limited public claim portal.

---

## Table of Contents

1. [Executive Overview & Value Proposition](#executive-overview--value-proposition)
2. [Key Capabilities & Features](#key-capabilities--features)
3. [System Architecture](#system-architecture)
4. [The Zero-Cloud Invariant & Web Worker Generation](#the-zero-cloud-invariant--web-worker-generation)
5. [Technology Stack](#technology-stack)
6. [Repository Structure](#repository-structure)
7. [Environment Configuration](#environment-configuration)
8. [Local Development Setup](#local-development-setup)
9. [Automated Verification & Acceptance Suites](#automated-verification--acceptance-suites)
10. [Batch Lifecycle & Domain Invariants](#batch-lifecycle--domain-invariants)
11. [Security, Tenant Isolation & Retention](#security-tenant-isolation--retention)
13. [Comprehensive Documentation Index](#comprehensive-documentation-index)
14. [License](#license)

---

## Executive Overview & Value Proposition

Organizers, educators, administrators, and event hosts regularly struggle with bulk document creation. Existing solutions frequently suffer from:
- **Fragile Layout Engines:** Forcing users to rebuild established PDF designs from scratch in proprietary cloud editors.
- **Privacy & Infrastructure Costs:** Server-side PDF generation that buffers millions of documents in cloud buckets, incurring heavy egress fees and increasing exposure of recipient Personally Identifiable Information (PII).
- **Silent Failures:** Silently dropping rows, clipping long names, or mangling characters when fields overflow.
- **Lost Corrections:** Spreadsheet revisions or spelling corrections made during review being wiped out upon re-upload.
- **Distribution Overhead:** Manually sending individual emails or insecurely sharing massive unpartitioned folders.

EmitDocs solves these issues with an **existing-PDF-first, client-rendered, privacy-preserving, and self-service issuance workflow**:
- **Upload Existing PDFs:** Upload any existing single- or multi-page text-based PDF; placeholder tokens (`{{field}}`, `<field>`, `{field}`) are detected automatically.
- **Tabular Ingestion:** Import recipient spreadsheets with automatic column mapping, duplicate detection, and strict schema validation.
- **Draft Gallery Proofing:** Inspect every personalized draft in a searchable gallery with real-time PDF rendering.
- **Inline Editing & Reconciliation:** Make inline corrections or re-import updated spreadsheets with 4-way diff reconciliation.
- **Cryptographic Snapshot Freezing:** Freeze approved data in an immutable, canonical key-sorted SHA-256 digest snapshot.
- **Zero-Cloud-Compute Web Worker Generation:** Stream generated PDFs and ZIP packages directly to client disk without intermediate cloud storage.
- **Self-Service Claim Portal:** Distribute credentials through a public claim portal where participants verify with passwords or auto-generated CSPRNG tokens, protected by Cloudflare Turnstile and sliding-window IP rate limiting.

---

## Key Capabilities & Features

### 1. Template Studio & Visual Field Mapping
- **Authenticated PDF Uploads:** Base templates are stored securely in Cloudinary under isolated tenant folders (`templates/{userId}/...`) using signed server-side intents (`POST /api/templates/sign-upload`).
- **Token Detection:** Automatically parses text layers via PDF.js to discover tokens matching `{{field}}`, `{field}`, `[field]`, `<field>`, and `$field` naming conventions.
- **Interactive Mapping Canvas:** Drag-and-drop bounding boxes with visual alignment snapping, margin guides, and layout node coordinates powered by `@xyflow/react` and `pdfjs-dist`.
- **Typography & Formatting:** Full control over font families, font sizes, colors (hex parsing), horizontal alignment (left, center, right), text transformations (uppercase, lowercase, capitalize), and date/number format masks.
- **Fit-Then-Flag Engine:** Dynamically calculates available bounding box space. Shrinks text within strict `[minFontSize, maxFontSize]` bounds; if the string still overflows, it flags the row with non-blocking warnings instead of silently clipping.
- **Append-Only Versioning:** Templates employ append-only `TemplateVersion` records with deterministic SHA-256 `mappingHash` calculations and Compare-And-Swap (CAS) optimistic concurrency control.
- **Thumbnail Auto-Healing:** Generates signed page-1 previews with automatic background validation and repair.
- 📖 *Documentation:* [Frontend Template Studio & Visual Canvas](docs/architecture-frontend-templates-and-mapping.md) · [PRD-CORE-02](docs/bulk-document-issuance-prd-pack-v1.0/PRD-CORE-02-TEMPLATE-LIBRARY-AND-UPLOAD.md) · [PRD-CORE-03](docs/bulk-document-issuance-prd-pack-v1.0/PRD-CORE-03-PDF-MAPPING-AND-PREVIEW.md)

### 2. High-Performance Spreadsheet Ingestion
- **Dual Format Support:** Client-side parsing of CSV files via `PapaParse` and multi-sheet Excel workbooks (`.xlsx`, `.xls`) via `SheetJS/xlsx`.
- **Worksheet Disambiguation:** Lets users select active worksheets and automatically resolves duplicate column headers.
- **Chunked Ingestion:** Streams parsed rows to the backend in bounded chunks ($\le 500$ rows) to remain safely within serverless payload thresholds.
- **Fingerprint Duplicate Detection:** Cross-checks records to tag identical recipient entries with `DUPLICATE_ROW` warnings while preserving them in the dataset.
- **Strict Validation Rules:** Evaluates rows against template field schemas, producing machine-readable codes (`REQUIRED_FIELD_MISSING`, `INVALID_DATE`, `INVALID_NUMBER`, `AMBIGUOUS_DATE`, `AMBIGUOUS_NUMBER`, `FORMULA_CACHE_MISSING`).
- 📖 *Documentation:* [Frontend Batches Workflow](docs/architecture-frontend-batches-workflow.md) · [PRD-CORE-04](docs/bulk-document-issuance-prd-pack-v1.0/PRD-CORE-04-SPREADSHEET-IMPORT-AND-VALIDATION.md)

### 3. Draft Review, Inline Editing & 4-Way Re-Import Reconciliation
- **Draft Gallery:** Searchable, paginated recipient card gallery rendering live PDF preview proofs via PDF.js.
- **Issue Filtering:** Real-time filter tabs for *All*, *Valid*, *Errors*, *Warnings*, and *Duplicates*.
- **Inline Row Overrides:** Correct spelling, dates, or numbers directly inside the review workspace. Updates use optimistic concurrency control (`patchDraftRow`), applying changes to `overrides` while preserving raw `importedData`.
- **4-Way Re-Import Diff Engine:** When uploading an updated spreadsheet, the intake engine compares records against existing drafts:
  - `unchanged`: Records identical in both revisions.
  - `added`: New rows present in the new file.
  - `removed`: Rows missing from the new file.
  - `conflicted`: Matching primary keys with diverging field values.
- **Override Preservation:** Existing inline edits transfer seamlessly across re-imports, and ambiguous collisions require explicit user resolution.
- 📖 *Documentation:* [Frontend Batches Workflow](docs/architecture-frontend-batches-workflow.md) · [Backend Services Architecture](docs/architecture-backend-services-and-business-logic.md) · [PRD-CORE-05](docs/bulk-document-issuance-prd-pack-v1.0/PRD-CORE-05-DRAFT-REVIEW-AND-RECONCILIATION.md)

### 4. Preflight Verification & Immutable Approval Snapshots
- **Preflight Review:** Summarizes total rows, valid recipients, excluded invalid rows, and template version status.
- **Configurable Retention:** Selectable retention horizons for batch draft and recipient records (24 hours, 7 days / 168 hours, 30 days / 720 hours).
- **Canonical Digest Hashing:** Calculates a deterministic, recursively key-sorted SHA-256 digest across all valid recipient records.
- **Immutable Snapshot Freezing:** Deep-copies valid draft rows into `ApprovedRecipient` records linked to an `ApprovedSnapshot`.
- **Post-Approval Invalidation:** Any subsequent draft modification or re-import instantly invalidates prior approvals (`approvedSnapshotId = null`), returning the batch to `review`.
- 📖 *Documentation:* [Backend Data Models & Infrastructure](docs/architecture-backend-data-models-infra.md) · [PRD-CORE-06](docs/bulk-document-issuance-prd-pack-v1.0/PRD-CORE-06-APPROVAL-AND-IMMUTABLE-SNAPSHOT.md)

### 5. Web Worker Batch Generation & Streaming Multi-Volume ZIPs
- **Zero Cloud Storage for Outputs:** Generated recipient PDFs are created purely inside browser memory and streamed into ZIP archives—zero recipient documents are stored on Cloudinary or MongoDB.
- **Off-Main-Thread Execution:** A dedicated Web Worker (`batch-generator.worker.ts`) executes a sequential loop using `pdf-lib` and `@pdf-lib/fontkit`. Macrotask yielding prevents main thread freezing and maintains an uninterrupted 60 FPS UI.
- **Sub-20ms Single Previews:** Single recipient previews and instant downloads render in `<20ms` (benchmark verified: ~9.93ms).
- **STORE Mode Streaming ZIP:** Packages output archives via `client-zip` in STORE mode (0x0000 uncompressed) for zero CPU compression overhead.
- **Direct-to-Disk Stream Piping:** Uses the modern FileSystem Access API (`saveZipStreamWithPicker`) to pipe the ZIP stream directly to the local disk, eliminating browser memory buffering and preventing tab crashes.
- **Dual-Boundary Volume Partitioning:** Automatically splits large batches using the more restrictive of 1,000 documents OR 1 GB per archive (`volume-partitioner.ts`), ensuring smooth downloads on any operating system.
- **Zip-Slip Directory Sanitization:** Sanitizes document filenames by stripping directory traversal sequences (`../`, `..\`) and OS-illegal characters, resolved with unique `_{recipientKey}` suffixes.
- 📖 *Documentation:* [Frontend PDF Engine & Web Workers](docs/architecture-frontend-engines-hooks-workers.md) · [PRD-CORE-07](docs/bulk-document-issuance-prd-pack-v1.0/PRD-CORE-07-RESUMABLE-PDF-GENERATION.md) · [PRD-CORE-08](docs/bulk-document-issuance-prd-pack-v1.0/PRD-CORE-08-DOWNLOADS-AND-ZIP.md)

### 6. Public Certificate Claim Portal & Self-Service Distribution (PRD-CORE-11)
- **Dedicated Participant Portals:** Organizers can publish a public-facing claim portal for any approved batch with a clean custom URL slug (`/claim/:publicSlug`).
- **Zero-Plaintext Credential Persistence:** Neither organizer-imported passwords nor auto-generated tokens are ever stored in plaintext. All verifications use keyed HMAC-SHA-256 verifiers (`HMAC(portalId:revision:credential)`).
- **Dual Credential Modes:**
  - *Organizer-Imported Credentials:* Map one or two spreadsheet fields (e.g., student ID, birthdate, or secret PIN) as the claim passkey.
  - *Secure Auto-Generated CSPRNG Tokens:* Generates cryptographically secure, high-entropy single-use claim tokens with collision-free guarantees and CSV export for organizers.
- **Anti-Bot Deterrence:** Server-side Cloudflare Turnstile token validation (`turnstile.ts`) ensures automated credential stuffing bots are blocked.
- **Sliding-Window IP Rate Limiter:** MongoDB-persisted sliding-window rate limiting (`claim-rate-limiter.ts`, `ClaimRateLimit`) with IP pseudonymization prevents brute-force enumeration across serverless instances.
- **Ephemeral Claim Sessions:** Validated claims issue a short-lived (15-minute) CSPRNG session ID stored exclusively as a SHA-256 hash in `ClaimSession`, setting secure `HttpOnly`, `SameSite: Lax` cookies.
- **On-Demand Browser PDF Synthesis:** Certificates are personalized in-memory on the fly and downloaded directly by the claimant—preserving the zero-cloud-storage invariant.
- **Real-Time Claim Telemetry:** Live organizer dashboard tracking total eligible recipients, claimed certificates, delivery timestamps, and state tracking (`ClaimRecipientState`).
- 📖 *Documentation:* [Shared Certificate Claim Portal PRD](docs/emitdocs-shared-certificate-claim-portal-prd-v1.0.md) · [PRD-CORE-11 Implementation Plan](docs/plans/2026-10-18-prd-core-11-shared-claim-portal.md)

### 7. Cloud Storage Consumption Analytics, Retention & Account Deletion (PRD-CORE-09)
- **Hybrid Storage API:** `GET /api/storage` queries Cloudinary Admin APIs under `templates/{userId}/` with smooth MongoDB fallback tracking active vs. soft-deleted template footprints.
- **TTL Auto-Pruning:** Background retention pruner (`retention-pruner.ts`) checks batch retention deadlines (24h, 7d, 30d). Expired batches are logically locked out (HTTP 410 Gone) followed by automated MongoDB TTL purging of recipient PII and Cloudinary garbage collection.
- **Cascading Account Deletion:** Full GDPR/DPDP compliant account deletion (`DELETE /api/account` and `DeleteAccountDialog.tsx`) which wipes all user templates, Cloudinary assets under `templates/{userId}/`, batches, draft rows, snapshots, approved recipients, and claim portals in a coordinated sweep.
- 📖 *Documentation:* [Storage API Spec](docs/user-cloud-storage-api-spec.md) · [Cloudinary Cleanup Research](docs/research-storage-and-cloudinary-cleanup.md) · [PRD-CORE-09](docs/bulk-document-issuance-prd-pack-v1.0/PRD-CORE-09-RETENTION-AND-ACCOUNT-DELETION.md)

### 8. Progressive Web App (PWA) & Offline Resilience
- **Offline Indicator & Service Worker:** Equipped with `site.webmanifest`, service worker caching (`sw.js`), install prompts, offline indicators, and network status banners.
- **Optimized UI Primitives:** Accessible UI built on Radix UI, `@hugeicons/react`, Lucide icons, and interactive WebGL canvas shaders (`ogl`).
- 📖 *Documentation:* [Frontend UI Primitives & Design System](docs/architecture-frontend-ui-primitives-and-shared.md)

---

## System Architecture

EmitDocs follows a decoupled, monorepo architecture: a React 19 frontend client interacting with a stateless Hono backend API, backed by MongoDB Atlas, Cloudinary, and Cloudflare Turnstile.

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Client Browser (web/)                                 │
│                                                                                 │
│   React 19 + TanStack Router + Tailwind CSS                                     │
│   ├─ Google OAuth (Better-Auth Client)                                          │
│   ├─ PDF Mapping Studio (pdfjs-dist + @xyflow/react)                            │
│   ├─ Spreadsheet Parser (PapaParse / SheetJS xlsx)                              │
│   ├─ Draft Review & CAS Overrides                                               │
│   ├─ Generation Dashboard & Volume Partitioner                                  │
│   ├─ FileSystem Access API Stream Piping (Direct-to-Disk)                       │
│   └─ Public Participant Claim Portal (/claim/:publicSlug)                       │
│            │                                                                    │
│            ▼                                                                    │
│   Off-Main-Thread Dedicated Web Worker (batch-generator.worker.ts)              │
│   ├─ Base PDF caching (ArrayBuffer)                                             │
│   ├─ pdf-lib + fontkit overlay engine                                           │
│   ├─ Sequential loop with macrotask yielding                                   │
│   └─ client-zip packaging (Dual-boundary: 1,000 docs OR 1 GB)                   │
└──────────────────────────┬──────────────────────────────────────────────────────┘
                           │ Same-origin /api requests
                           │ HttpOnly session cookies & Turnstile tokens
                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      Backend API Server (api/ - Hono)                           │
│                                                                                 │
│   Hono Router (/api)                                                            │
│   ├─ Global Middleware Pipeline (validateEnvironment, requestId, safeLogger)    │
│   ├─ Dynamic CORS & Allowed Origins Validation (resolveCorsOrigin)              │
│   ├─ requireAuth Middleware (Better-Auth Session Resolution)                    │
│   ├─ Templates Route (/templates - CAS bumps, Cloudinary upload signatures)     │
│   ├─ Batches Route (/batches - Chunk ingest, 4-way diffs, snapshot approval)    │
│   ├─ Claim Portals Route (/claim-portals - Portal lifecycle, token generation)  │
│   ├─ Public Claim Route (/public/claim-portals - Participant claims & sessions) │
│   ├─ Storage Route (/storage - Hybrid Cloudinary inspection + MongoDB fallback) │
│   ├─ Account Route (/account - Cascading account & cloud asset deletion)        │
│   └─ Services: Keyed Verifiers, Turnstile, Retention Pruner, Account Deletion   │
└──────────────────────────┬─────────────────────────────┬────────────────────────┘
                           │                             │
                           ▼                             ▼
┌──────────────────────────────────────────┐  ┌───────────────────────────────────┐
│         MongoDB Atlas Database           │  │        Cloud Integrations         │
│               (13 Models)                │  │                                   │
│  - users & sessions (Better-Auth)        │  │  Cloudinary Media Cloud:          │
│  - templates & templateVersions          │  │  ├─ Base PDF templates            │
│  - batches & batchImports                │  │  └─ Auto-healed page thumbnails   │
│  - draftRows (imported, overrides, eff.) │  │  Cloudflare Turnstile:            │
│  - approvedSnapshots & approvedRecipients│  │  └─ Cryptographic bot defense     │
│  - claimPortals & claimCredentialSets    │  │  FileSystem Access API:           │
│  - claimCredentials (HMAC verifiers)     │  │  └─ Direct-to-disk ZIP stream     │
│  - claimSessions & claimRecipientStates  │  │                                   │
│  - claimRateLimits (Sliding window IP)   │  │  (Zero recipient PDFs in cloud!)  │
└──────────────────────────────────────────┘  └───────────────────────────────────┘
```

For the comprehensive system architecture documentation, consult the [EmitDocs Master System Architecture](docs/EMITDOCS_MASTER_SYSTEM_ARCHITECTURE.md).

---

## The Zero-Cloud Invariant & Web Worker Generation

Traditional bulk document tools render recipient files on remote servers and store thousands of temporary PDFs in object buckets, creating substantial egress costs, storage bloat, and privacy risks.

EmitDocs adheres to an explicit **Zero Cloud Storage for Recipient PDFs** invariant:

1. **One-Time Base Asset Retrieval:** The client downloads the base PDF template once via an authorized, authenticated proxy endpoint (`GET /api/templates/:id/versions/:version/file`).
2. **Local Worker Processing:** The Web Worker draws dynamic values into new PDF documents in browser memory using transferable `ArrayBuffer` objects.
3. **Flat Memory Allocation (<150 MB):** Generated documents are streamed into `client-zip` in STORE mode and immediately garbage-collected. The worker does not retain document buffers in heap memory.
4. **Direct-to-Disk Stream Piping:** On modern browsers, the FileSystem Access API pipes ZIP chunks directly to disk (`showSaveFilePicker`), ensuring zero memory exhaustion.
5. **Dual-Boundary Volume Splitting:** Generating batches of 5,000 documents never creates a massive multi-gigabyte browser download. The partitioner divides outputs into discrete archives using the more restrictive of 1,000 items OR 1 GB (`part-1.zip`, `part-2.zip`).
6. **Absolute Privacy:** Personal data from the spreadsheet is mapped to PDFs solely on the user's local machine; recipient PDFs never travel across the network.
7. **On-Demand Public Claiming:** When using the claim portal, certificates are synthesized client-side on the recipient's device upon credential verification, maintaining zero server-side PDF storage.

---

## Technology Stack

### Frontend Client (`web/`)
| Component | Technology | Rationale / Implementation |
| :--- | :--- | :--- |
| **Framework** | React 19 + TypeScript | High performance, modern concurrent primitives |
| **Build Tool** | Vite 8 + TSConfig Paths | Instant HMR and optimized production bundling |
| **Routing** | TanStack Router 1.170 | Type-safe, file-based routing (`src/routes`) |
| **Styling** | Tailwind CSS 3.4 + PostCSS | Utility-first, responsive interface design |
| **Canvas & Nodes** | `@xyflow/react` 12.12 | Drag-and-drop bounding box layout studio |
| **PDF Rendering** | `pdfjs-dist` 4.10 | Viewport inspection, token extraction, preview canvas |
| **PDF Drawing** | `pdf-lib` 1.17 + `@pdf-lib/fontkit` | Client-side font embedding, overlays, AcroForm flattening |
| **Archive Streaming**| `client-zip` 2.5 + FileSystem API | Spec-compliant, in-memory STORE mode zero-copy streaming to disk |
| **Data Parsing** | `papaparse` + `xlsx` (SheetJS) | Fast, client-side CSV and Excel workbook ingestion |
| **UI Primitives** | Radix UI Primitives | Accessible Select, Tooltip, Popover, Slot, Dialog components |
| **Icons & Shaders** | Phosphor, Lucide, HugeIcons & `ogl` | Clean visual language and interactive WebGL canvas shaders |
| **Motion** | `motion` 14.1 | Micro-interactions and animated progress transitions |

### Backend API (`api/`)
| Component | Technology | Rationale / Implementation |
| :--- | :--- | :--- |
| **Server Framework**| Hono 4.4 on Node.js / Vercel | Lightweight, ultra-fast, standards-compliant routing |
| **Database** | MongoDB 7.7 + Mongoose 8.4 | 13 scalable document schemas, atomic operations, TTL indexes |
| **Authentication** | Better-Auth 1.7 + Mongo Adapter | Google Identity OAuth, secure session cookies, CSRF guards |
| **Media Storage** | Cloudinary 2.11 | Signed base PDF storage, dual asset streaming, thumbnails |
| **Keyed Verifiers** | Node.js `node:crypto` | HMAC-SHA-256 verifiers for zero-plaintext claim credentials |
| **Bot Deterrence** | Cloudflare Turnstile | Cryptographic bot challenge verification (`turnstile.ts`) |
| **Validation** | Zod 3.23 + `@hono/zod-validator` | Strict runtime request parsing and type inference |
| **Environment** | Dotenv + Production Guard | Fail-closed configuration check across environments |

### Testing & Verification (`test/`)
| Component | Technology | Scope |
| :--- | :--- | :--- |
| **Runtime Execution**| `tsx` (TypeScript Execute) | Fast, compilation-free test execution |
| **Linter** | Oxlint 1.81 | Ultra-fast Rust-based static analysis |
| **Assertions** | Node.js `node:assert/strict` | Zero-dependency, deterministic unit & matrix assertions |
| **API Contract** | OpenAPI 3.1 & Drift Checker | Automated OpenAPI spec generation and TypeScript drift checks |

---

## Repository Structure

```text
EmitDocs/
├── api/                             # Backend API service (Hono)
│   ├── api/index.ts                 # Vercel serverless entry point
│   ├── src/
│   │   ├── auth.ts                  # Better-Auth configuration & adapter
│   │   ├── config/                  # Production guard and fail-closed env validation
│   │   ├── controllers/             # HTTP transport controllers
│   │   │   ├── account.controller.ts      # Cascading account deletion
│   │   │   ├── batches.controller.ts      # Intake, diffs, overrides, snapshots
│   │   │   ├── claim-portals.controller.ts# Organizer claim portal lifecycle
│   │   │   ├── health.controller.ts       # Service health checks
│   │   │   ├── public-claim.controller.ts # Public participant claim endpoints
│   │   │   ├── storage.controller.ts      # Storage quota inspection
│   │   │   └── templates.controller.ts    # Template CRUD and upload intents
│   │   ├── lib/                     # Database, Cloudinary, origins & transactions
│   │   ├── middleware/              # Auth, Request-ID & safe JSON logging
│   │   ├── models/                  # Mongoose data schemas (13 models)
│   │   │   ├── ApprovedRecipient.ts       # Frozen recipient record
│   │   │   ├── ApprovedSnapshot.ts        # Sealed immutable batch snapshot
│   │   │   ├── Batch.ts                   # Central batch lifecycle state model
│   │   │   ├── BatchImport.ts             # Spreadsheet intake revision
│   │   │   ├── ClaimCredential.ts         # HMAC-keyed participant verifier
│   │   │   ├── ClaimCredentialSet.ts      # Credential configuration & mode
│   │   │   ├── ClaimPortal.ts             # Public portal status & metadata
│   │   │   ├── ClaimRateLimit.ts          # Sliding-window IP rate limiter
│   │   │   ├── ClaimRecipientState.ts     # Delivery & download status
│   │   │   ├── ClaimSession.ts            # Ephemeral 15-minute claim session
│   │   │   ├── DraftRow.ts                # Granular row data (imported + overrides)
│   │   │   ├── Template.ts                # Root template metadata
│   │   │   └── TemplateVersion.ts         # Immutable versioned mappings
│   │   ├── routes/                  # Sub-routers (/templates, /batches, /claim-portals, etc.)
│   │   ├── scripts/                 # OpenAPI 3.1 generation & contract drift check
│   │   └── services/                # Deep domain business logic
│   │       ├── account-deletion.ts        # Coordinated data and cloud asset wipe
│   │       ├── batch-approval.ts          # Canonical digest & snapshot engine
│   │       ├── batch-intake.ts            # Chunk ingestion & deduplication
│   │       ├── claim-delivery.ts          # Public credential check & session issuance
│   │       ├── claim-portal-lifecycle.ts  # Portal state transitions & token generation
│   │       ├── claim-rate-limiter.ts      # Sliding-window IP brute-force guard
│   │       ├── cloudinary-cleanup.ts      # Orphan asset garbage collection
│   │       ├── keyed-verifier.ts          # HMAC credential hashing & validation
│   │       ├── participant-claim.ts       # Participant claim processing
│   │       ├── retention-pruner.ts        # Retention deadline check & TTL pruning
│   │       ├── spreadsheet/               # Diff calculators & row validators
│   │       ├── template-lifecycle.ts      # Versioning CAS & thumbnail health
│   │       └── turnstile.ts               # Cloudflare Turnstile token validation
│   ├── package.json
│   └── tsconfig.json
│
├── web/                             # Frontend client application (React 19)
│   ├── public/                      # Static assets, fonts, icons, PWA manifest
│   │   ├── pwa/site.webmanifest     # Web application manifest
│   │   └── sw.js                    # Service worker offline caching
│   ├── src/
│   │   ├── components/              # Modular UI components
│   │   │   ├── batches/             # Intake, review, approval & results views
│   │   │   ├── claim/               # Public participant claim form, Turnstile & preview
│   │   │   ├── landing/             # Marketing landing page sections
│   │   │   ├── layout/              # AppShell and PageShell navigation wrappers
│   │   │   ├── legal/               # Privacy, terms & subprocessor tables
│   │   │   ├── pwa/                 # Install cards & offline banners
│   │   │   ├── settings/            # Delete account dialog and preferences
│   │   │   ├── skeletons/           # Loading state skeleton primitives
│   │   │   ├── templates/           # Visual canvas & mapping studio
│   │   │   └── ui/                  # Primitives (Select, Tooltip, Dialog, Toasts)
│   │   ├── hooks/                   # Custom React hooks (Worker, PWA, History)
│   │   ├── lib/                     # PDF engine, helpers & navigation
│   │   │   ├── batch-navigation.ts        # Centralized lifecycle routing helper
│   │   │   ├── pdf-engine/                # Overlays, formatters, tokens, snapper, zip
│   │   │   └── spreadsheet/               # Normalizers, validators & duplicate detector
│   │   ├── routes/                  # TanStack Router file routes
│   │   │   ├── _protected/app/            # Protected dashboard, batches & templates
│   │   │   ├── claim/$publicSlug.tsx      # Public participant claim portal
│   │   │   ├── index.tsx                  # Public landing page
│   │   │   ├── privacy.tsx & terms.tsx    # Legal policy pages
│   │   │   └── sign-in.tsx                # Google authentication screen
│   │   └── workers/                 # Dedicated background execution
│   │       ├── batch-generator.handler.ts # PDF generator loop & metrics
│   │       └── batch-generator.worker.ts  # Web Worker thread interface
│   ├── package.json
│   └── vite.config.ts
│
├── test/                            # Acceptance test matrices & benchmark suites
│   ├── acceptance-matrix.test.ts          # PRD-CORE-03 visual mapping matrix
│   ├── batch-navigation.test.ts           # Lifecycle state navigation mappings
│   ├── claim-portal-lifecycle.test.ts     # PRD-CORE-11 claim portal management
│   ├── claim-retention.test.ts            # Claim session and credential TTLs
│   ├── core-04-acceptance-matrix.test.ts  # Spreadsheet intake & 5k benchmark
│   ├── core-05-acceptance-matrix.test.ts  # Draft review, search & diffing
│   ├── core-06-acceptance-matrix.test.ts  # Snapshots, digests & CAS approval
│   ├── core-07-acceptance-matrix.test.ts  # Web worker generation benchmarks
│   ├── core-08-acceptance-matrix.test.ts  # Streaming ZIP & volume partitioning
│   ├── core-09-acceptance-matrix.test.ts  # Retention horizons & account deletion
│   ├── core-10-acceptance-matrix.test.ts  # Pilot readiness, CI/CD, caps & drift matrix
│   ├── core-11-acceptance-matrix.test.ts  # Consolidated claim portal AC matrix
│   ├── filename-sanitizer.test.ts         # Zip-slip and path sanitization
│   ├── keyed-verifier.test.ts             # HMAC-SHA-256 verifiers
│   ├── public-claim.test.ts               # Public claim participant flow & rate limits
│   ├── pwa-features.test.ts               # Manifest and service worker validation
│   ├── streaming-zip.test.ts              # STORE mode streaming ZIP packaging
│   ├── volume-partitioner.test.ts         # Dual-boundary volume partitioning
│   ├── smoke/preview-smoke.test.ts        # Preview engine smoke tests
│   └── fixtures/                          # Test PDFs (fragmented tokens, rotated pages)
│
├── docs/                            # Specifications, PRDs, architecture & guides
├── run.sh                           # Multi-process concurrent server launcher
├── package.json                     # Monorepo root scripts & test runners
└── README.md                        # Project documentation
```

---

## Environment Configuration

### Backend Configuration (`api/.env`)
Create a `.env` file inside the `api/` directory (refer to [`api/.env.example`](api/.env.example)):

```ini
# Server Port & Node Environment
PORT=3000
NODE_ENV=development
ENABLE_TEST_AUTH=false

# MongoDB Connection
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
DB_NAME=emitdocs

# Better-Auth Configuration
BETTER_AUTH_SECRET=your_32_character_random_secret_here
BETTER_AUTH_URL=http://localhost:3000

# Google OAuth Credentials (Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Cloudinary Storage Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# CORS Allowed Origins (Comma-separated for multiple domains)
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Cloudflare Turnstile Configuration (Bot deterrence for claim portal)
TURNSTILE_SECRET_KEY=your_cloudflare_turnstile_secret_key
TURNSTILE_ALLOW_BYPASS=true
```

### Frontend Configuration (`web/.env`)
Create a `.env` file inside the `web/` directory (refer to [`web/.env.example`](web/.env.example)):

```ini
# Backend API Base URL (Points to the Hono /api basePath)
VITE_API_BASE_URL=http://localhost:3000/api

# Google OAuth Client ID (Public web client ID)
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# Cloudflare Turnstile Site Key (Public site key for bot verification)
VITE_TURNSTILE_SITE_KEY=your_cloudflare_turnstile_site_key
```

---

## Local Development Setup

### Prerequisites
- **Node.js:** `v20.x` or `v22.x` (LTS recommended)
- **Package Manager:** `pnpm` (v9.x or higher)
- **Database:** Local MongoDB instance or free MongoDB Atlas cluster
- **Cloud Accounts:** Free Cloudinary account and Google Cloud OAuth credentials

### Step-by-Step Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/jimfleax/EmitDocs.git
   cd EmitDocs
   ```

2. **Install monorepo dependencies:**
   ```bash
   pnpm install
   cd api && pnpm install
   cd ../web && pnpm install
   cd ..
   ```

3. **Configure environment variables:**
   Set up `api/.env` and `web/.env` using the examples above.

4. **Start development servers:**
   Use the root launcher script to boot both the frontend and backend servers concurrently with color-coded logging:
   ```bash
   chmod +x run.sh
   ./run.sh
   ```

   The script verifies port availability, auto-releases stale locks on ports `3000` and `5173`, and mounts:
   - **Frontend App:** `http://localhost:5173`
   - **API Server:** `http://localhost:3000/api`

   *Useful options for `./run.sh`:*
   - `./run.sh --lint` : Runs code linters across `web` and `api` before launching.
   - `./run.sh --prettify` : Runs formatters across all packages prior to launch.

---

## Automated Verification & Acceptance Suites

EmitDocs includes comprehensive unit, integration, and end-to-end acceptance test matrices verified against production scenarios.

### Running the Full Test Suite
To execute all test suites sequentially:
```bash
pnpm test
```

### Granular Test Commands
| Script | Command | Target Domain |
| :--- | :--- | :--- |
| `test:backend` | `pnpm run test:backend` | Template versioning & CAS conflict detection |
| `test:auth` | `pnpm run test:auth` | Google OAuth redirect URI normalization & origins |
| `test:storage` | `pnpm run test:storage` | Hybrid Cloudinary storage inspection API |
| `test:engine` | `pnpm run test:engine` | PDF layout calculations, fit-then-flag & glyphs |
| `test:ac` | `pnpm run test:ac` | PRD-CORE-03: Visual token & field mapping matrix |
| `test:core04` | `pnpm run test:core04` | PRD-CORE-04: Spreadsheet intake & 5,000-row benchmark |
| `test:core05` | `pnpm run test:core05` | PRD-CORE-05: Draft review, inline CAS edits & diff engine |
| `test:core06` | `pnpm run test:core06` | PRD-CORE-06: Approval preflight & immutable snapshot |
| `test:core07` | `pnpm run test:core07` | PRD-CORE-07: Web Worker generation (<20ms benchmark) |
| `test:core08` | `pnpm run test:core08` | PRD-CORE-08: Streaming multi-volume ZIPs & FileSystem API |
| `test:core09` | `pnpm run test:core09` | PRD-CORE-09: Retention horizons, TTL auto-pruning & account deletion |
| `test:core10` | `pnpm run test:core10` | PRD-CORE-10: Pilot readiness, CI/CD, caps & drift matrix |
| `test:core11` | `pnpm run test:core11` | PRD-CORE-11: Public certificate claim portal & keyed verifiers |
| `test:smoke` | `pnpm run test:smoke` | Single recipient preview & download smoke tests |
| `test:nav` | `pnpm run test:nav` | Batch lifecycle state-to-route navigation matrix |
| `test:ui` | `pnpm run test:ui` | Radix Select accessible component primitives |
| `test:skeleton`| `pnpm run test:skeleton`| Skeleton loading state animations |
| `test:pwa` | `pnpm run test:pwa` | PWA manifest, service worker & offline handling |
| `test:toast` | `pnpm run test:toast` | Toast notification lifecycle & timers |
| `test:tooltip` | `pnpm run test:tooltip` | Tooltip positioning, flips & boundary clamping |
| `contract:generate` | `pnpm run contract:generate` | Generate OpenAPI 3.1 schema from route types |
| `contract:check` | `pnpm run contract:check` | Verify OpenAPI spec against TypeScript client contracts |

---

## Batch Lifecycle & Domain Invariants

A Batch progresses through an explicit, strictly guarded state machine:

```text
[draft] ───► [importing] ───► [review] ◄───► [awaiting_approval]
                                 │                   │
                                 │                   ▼
                                 │              [approved] ───► [claim_portal]
                                 │                   │
                                 │                   ▼
                                 │             [generating]
                                 │             (pause/resume)
                                 │                   │
                                 │                   ▼
                                 └──────────► [ready_for_download]
                                                     │
                                                     ▼
                                            [expired / deleting]
```

### State-to-Route Navigation Mapping
Managed centrally by [`web/src/lib/batch-navigation.ts`](web/src/lib/batch-navigation.ts):
- **`draft` / `importing`:** Navigates to `/app/batches/:id/import` ("Continue Import")
- **`review`:** Navigates to `/app/batches/:id/review` ("Review Data")
- **`awaiting_approval`:** Navigates to `/app/batches/:id/approve` ("Approve Batch")
- **`approved` / `ready_for_download`:** Navigates directly to `/app/batches/:id/results` ("Download & Preview")
- **`generating` / `paused`:** Navigates to `/app/batches/:id/results` ("View Progress" / "Resume Generation")
- **`cancelled` / `failed`:** Routes to `/app/batches/:id/results` if an approved snapshot exists, else `/review`.
- **`expired`:** Returns HTTP 410 Gone; UI navigates to batches list with expiry badge.

### Optimistic Concurrency Invariants
- **Templates:** Publishing a field mapping modification requires supplying the current `version`. The server increments the version counter via CAS; mismatched version numbers reject with `409 VersionConflictError`.
- **Draft Rows:** Inline edits (`patchDraftRow`) mandate matching row `version` numbers. Concurrent edits are safely rejected without overwriting unsaved changes.
- **Approval Seal:** When a batch is approved, an immutable `ApprovedSnapshot` is created with a canonical SHA-256 digest. If an edit or re-import occurs, the prior snapshot is superseded and the batch reverts to `review`.
- **Claim Portal Mode Isolation:** Switching between organizer-imported credentials and generated tokens revokes all previous credentials, invalidating all existing participant sessions.

---

## Security, Tenant Isolation & Retention

- **Authentication & Sessions:** Google OAuth with token signature verification on the backend via Better-Auth. Sessions are preserved in secure `HttpOnly`, `SameSite: Lax` cookies with dynamic origin whitelisting.
- **Tenant Isolation:** Every template, batch, row, and cloud asset operation strictly enforces ownership (`ownerId === session.user.id`). Cross-tenant access attempts return `404 Not Found` to prevent resource enumeration.
- **Zero-Plaintext Claim Credentials:** Passwords and tokens in the public claim portal are hashed with keyed HMAC-SHA-256 verifiers (`HMAC(portalId:revision:credential)`). Session IDs are stored exclusively as SHA-256 hashes.
- **Storage Scoping:** Cloudinary uploads are strictly constrained to `templates/{userId}/...`. The backend signs explicit timestamps, folder paths, and public IDs—clients cannot upload to arbitrary destinations.
- **PII Minimization & Expiry:** Batch data retention is user-configurable (24h, 7d, 30d). Upon expiration, raw spreadsheet data and recipient records are purged from MongoDB, while reusable base PDF templates persist until deleted by the user.
- **Cascading Account Deletion:** Full account deletion purges the user profile, all associated batches, draft rows, snapshots, approved recipients, claim portals, and deletes the tenant's Cloudinary storage directory.

---

## Comprehensive Documentation Index

All primary architectural decisions, domain models, specifications, and operational guides are documented in the [`docs/`](docs/) directory:

### Master Architecture & Operational Guides
- [EmitDocs Master System Architecture](docs/EMITDOCS_MASTER_SYSTEM_ARCHITECTURE.md) — Comprehensive technical reference detailing system philosophy, coordinate mathematics, lifecycle state machines, security invariants, and complete topography.
- [Operator Setup & Deployment Guide](docs/OPERATOR_SETUP_GUIDE.md) — Production deployment runbook, environment secrets, DNS, Cloudinary setup, Google OAuth configuration, and monitoring.
- [Master Project Documentation & Index](docs/bulk-document-issuance-project-docs-v1.0/00_README_AND_INDEX.md) — Project foundation, market research, brand identity, and executive dossier.

### Subsystem Architecture Specifications
- [Backend API Surface & Middleware Pipeline](docs/architecture-backend-api-surface.md) — Hono router architecture, global middleware chain, request tracing, and standardized error schemas.
- [Backend Data Models & Infrastructure](docs/architecture-backend-data-models-infra.md) — Mongoose schemas across 13 models, compound indexes, TTL eviction, transactions, and serverless connection pooling.
- [Backend Domain Services & Business Logic](docs/architecture-backend-services-and-business-logic.md) — Intake engine, 4-way diffing, canonical digest hashing, keyed verifiers, and cleanup services.
- [Frontend Routes & Navigation Hierarchy](docs/architecture-frontend-routes-and-navigation.md) — TanStack Router file-based tree, route guards, public claim routing, and state transitions.
- [Frontend Batches Workflow & CAS Review](docs/architecture-frontend-batches-workflow.md) — Spreadsheet intake, column mapping, draft gallery proofing, and inline cell editing.
- [Frontend Template Studio & Visual Canvas](docs/architecture-frontend-templates-and-mapping.md) — React Flow canvas, dual affine coordinate transforms, PDF.js token discovery, and alignment snapping.
- [Frontend PDF Engine, Web Workers & Streaming ZIP](docs/architecture-frontend-engines-hooks-workers.md) — Web Worker document synthesis, macrotask yielding, STORE mode streaming ZIP, and FileSystem Access API.
- [Frontend UI Primitives & Design System](docs/architecture-frontend-ui-primitives-and-shared.md) — Radix UI accessible primitives, responsive design tokens, and skeleton animations.
- [Testing Architecture & Acceptance Matrix](docs/architecture-testing-and-acceptance-suites.md) — End-to-end acceptance matrices, throughput benchmarks, and verification methodology.

---

## License

This project is licensed under the [MIT License](LICENSE).
