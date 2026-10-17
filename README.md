# EmitDocs

> **Document Automation · Bulk Issuance**  
> *One template. Every recipient. Ready to go.*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4%2B-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-61dafb.svg)](https://react.dev/)
[![Hono](https://img.shields.io/badge/Hono-4.4-E36002.svg)](https://hono.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.7%2B-47A248.svg)](https://www.mongodb.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-38B2AC.svg)](https://tailwindcss.com/)
[![PWA](https://img.shields.io/badge/PWA-Ready-purple.svg)](https://web.dev/progressive-web-apps/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

EmitDocs is a bulk document personalization and issuance web application. It takes existing text-based PDF designs and tabular datasets (CSV/XLSX), assists users in visually mapping placeholders or layout regions, provides an interactive draft review gallery with inline error correction and re-import reconciliation, seals approved data into immutable snapshots, and generates individualized PDFs and streaming multi-part ZIP archives entirely client-side via dedicated Web Workers.

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
12. [Release Boundary & Roadmap](#release-boundary--roadmap)

---

## Executive Overview & Value Proposition

Organizers, educators, administrators, and event hosts regularly struggle with bulk document creation. Existing solutions frequently suffer from:
- **Fragile Layout Engines:** Forcing users to rebuild established PDF designs from scratch in proprietary cloud editors.
- **Privacy & Infrastructure Costs:** Server-side PDF generation that buffers millions of documents in cloud buckets, incurring heavy egress fees and increasing exposure of recipient Personally Identifiable Information (PII).
- **Silent Failures:** Silently dropping rows, clipping long names, or mangling characters when fields overflow.
- **Lost Corrections:** Spreadsheet revisions or spelling corrections made during review being wiped out upon re-upload.

EmitDocs solves these issues with an **existing-PDF-first, client-rendered, and privacy-preserving workflow**:
- Upload an existing text-based PDF; placeholder tokens are detected automatically.
- Import recipient spreadsheets with automatic column mapping, duplicate detection, and schema validation.
- Inspect every personalized draft in a searchable gallery with real-time PDF rendering.
- Make inline corrections or re-import updated spreadsheets with 4-way diff reconciliation.
- Freeze approved data in an immutable, canonical SHA-256 digest snapshot.
- Stream generated PDFs and ZIP packages directly out of client browser memory without intermediate cloud storage.

---

## Key Capabilities & Features

### 1. Template Studio & Visual Field Mapping
- **Authenticated PDF Uploads:** Base templates are stored securely in Cloudinary under isolated tenant folders (`templates/{userId}/...`) using signed server-side intents (`POST /api/templates/sign-upload`).
- **Token Detection:** Automatically parses text layers via PDF.js to discover tokens matching `{{field}}` naming conventions.
- **Interactive Mapping Canvas:** Drag-and-drop bounding boxes with visual alignment snapping, margin guides, and layout node coordinates powered by `@xyflow/react` and `pdfjs-dist`.
- **Typography & Formatting:** Full control over font families, font sizes, colors (hex parsing), horizontal alignment (left, center, right), text transformations (uppercase, lowercase, capitalize), and date/number format masks.
- **Fit-Then-Flag Engine:** Dynamically calculates available bounding box space. Shrinks text within strict `[minFontSize, maxFontSize]` bounds; if the string still overflows, it flags the row with non-blocking warnings instead of silently clipping.
- **Append-Only Versioning:** Templates employ append-only `TemplateVersion` records with deterministic SHA-256 `mappingHash` calculations and Compare-And-Swap (CAS) optimistic concurrency control.
- **Thumbnail Auto-Healing:** Generates signed page-1 previews with automatic background validation and repair.

### 2. High-Performance Spreadsheet Ingestion
- **Dual Format Support:** Client-side parsing of CSV files via `PapaParse` and multi-sheet Excel workbooks (`.xlsx`, `.xls`) via `SheetJS/xlsx`.
- **Worksheet Disambiguation:** Lets users select active worksheets and automatically resolves duplicate column headers.
- **Chunked Ingestion:** Streams parsed rows to the backend in bounded chunks ($\le 500$ rows) to remain safely within serverless payload thresholds.
- **Fingerprint Duplicate Detection:** Cross-checks records to tag identical recipient entries with `DUPLICATE_ROW` warnings while preserving them in the dataset.
- **Strict Validation Rules:** Evaluates rows against template field schemas, producing machine-readable codes (`REQUIRED_FIELD_MISSING`, `INVALID_DATE`, `INVALID_NUMBER`, `AMBIGUOUS_DATE`).

### 3. Draft Review, Inline Editing & 4-Way Re-Import Reconciliation
- **Draft Gallery:** Searchable, paginated recipient card gallery rendering live PDF preview proofs via PDF.js.
- **Issue Filtering:** Real-time filter tabs for *All*, *Valid*, *Errors*, *Warnings*, and *Duplicates*.
- **Inline Row Overrides:** Correct spelling, dates, or numbers directly inside the review workspace. Updates use optimistic concurrency control (`patchRowOverride`), applying changes to `overrides` while preserving raw `importedData`.
- **4-Way Re-Import Diff Engine:** When uploading an updated spreadsheet, the intake engine compares records against existing drafts:
  - `unchanged`: Records identical in both revisions.
  - `added`: New rows present in the new file.
  - `removed`: Rows missing from the new file.
  - `conflicted`: Matching primary keys with diverging field values.
- **Override Preservation:** Existing inline edits transfer seamlessly across re-imports, and ambiguous collisions require explicit user resolution.

### 4. Preflight Verification & Immutable Approval Snapshots
- **Preflight Review:** Summarizes total rows, valid recipients, excluded invalid rows, and template version status.
- **Configurable Retention:** Selectable retention horizons for batch draft and recipient records (24 hours, 7 days / 168 hours, 30 days / 720 hours).
- **Canonical Digest Hashing:** Calculates a deterministic, recursively key-sorted SHA-256 digest across all valid recipient records.
- **Immutable Snapshot Freezing:** Deep-copies valid draft rows into `ApprovedRecipient` records linked to an `ApprovedSnapshot`.
- **Post-Approval Invalidation:** Any subsequent draft modification or re-import instantly invalidates prior approvals (`approvedSnapshotId = null`), returning the batch to `review`.

### 5. Web Worker Batch Generation & Streaming ZIPs
- **Zero Cloud Storage for Outputs:** Generated recipient PDFs are created purely inside browser memory and streamed into ZIP archives—zero recipient documents are stored on Cloudinary or MongoDB.
- **Off-Main-Thread Execution:** A dedicated Web Worker (`batch-generator.worker.ts`) executes a sequential loop using `pdf-lib` and `@pdf-lib/fontkit`. Macrotask yielding prevents main thread freezing and maintains an uninterrupted 60 FPS UI.
- **Sub-20ms Single Previews:** Single recipient previews and instant downloads render in `<20ms` (benchmark verified: ~9.93ms).
- **Real-Time Throughput Dashboard:** Live metrics displaying processed counts, percentage completion, documents/sec generation rate, and dynamic ETA countdowns.
- **Pause, Resume & Cancel:** Boundary-accurate worker control allows users to pause generation, resume where they left off, or cancel immediately.
- **1,000-Document Volume Splitting:** Batches exceeding 1,000 recipients partition into discrete archives (`{batchName}_part-1.zip`, `{batchName}_part-2.zip`) via `client-zip`, guaranteeing a flat memory footprint under 150 MB RAM.
- **Zip-Slip Directory Sanitization:** Sanitizes document filenames by stripping directory traversal sequences (`../`, `..\`) and OS-illegal characters, resolved with unique `_{recipientKey}` suffixes.

### 6. Cloud Storage Consumption Analytics & PWA
- **Hybrid Storage API:** `GET /api/storage` queries Cloudinary Admin APIs under `templates/{userId}/` with smooth MongoDB fallback tracking active vs. soft-deleted template footprints.
- **Progressive Web App (PWA):** Equipped with `site.webmanifest`, service worker caching (`sw.js`), install prompts, offline indicators, and network status banners.

---

## System Architecture

EmitDocs follows a decoupled, monorepo architecture: a React frontend client interacting with a stateless Hono backend API, backed by MongoDB Atlas and Cloudinary.

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Client Browser (web/)                                 │
│                                                                                 │
│   React 19 + TanStack Router + Tailwind CSS                                     │
│   ├─ Google OAuth (Better-Auth Client)                                          │
│   ├─ PDF Mapping Studio (pdfjs-dist + @xyflow/react)                            │
│   ├─ Spreadsheet Parser (PapaParse / SheetJS xlsx)                              │
│   ├─ Draft Review & CAS Overrides                                               │
│   └─ Generation Dashboard                                                       │
│            │                                                                    │
│            ▼                                                                    │
│   Off-Main-Thread Dedicated Web Worker (batch-generator.worker.ts)              │
│   ├─ Base PDF caching (ArrayBuffer)                                             │
│   ├─ pdf-lib + fontkit overlay engine                                           │
│   ├─ Sequential loop with macrotask yielding                                   │
│   └─ client-zip packaging (1,000-document volume partitioner)                   │
└──────────────────────────┬──────────────────────────────────────────────────────┘
                           │ Same-origin /api requests
                           │ HttpOnly session cookies
                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      Backend API Server (api/ - Hono)                           │
│                                                                                 │
│   Hono Router (/api)                                                            │
│   ├─ requireAuth Middleware (Better-Auth Session Resolution)                    │
│   ├─ Dynamic CORS & Allowed Origins Validation                                  │
│   ├─ Templates Controller & Lifecycle Service (CAS bumps, SHA-256 mappingHash)  │
│   ├─ Batches Controller & Intake Service (Chunk ingest, deduplication, diffs)   │
│   ├─ Approval Service (Preflight, canonical digests, snapshot freezing)        │
│   └─ Storage Controller (Hybrid Cloudinary inspection + MongoDB fallback)       │
└──────────────────────────┬─────────────────────────────┬────────────────────────┘
                           │                             │
                           ▼                             ▼
┌──────────────────────────────────────────┐  ┌───────────────────────────────────┐
│          MongoDB Atlas Database          │  │        Cloudinary Storage         │
│                                          │  │                                   │
│  - users & sessions (Better-Auth)        │  │  templates/{userId}/              │
│  - templates & templateVersions          │  │  ├─ Base PDF source files         │
│  - batches & batchImports                │  │  └─ Auto-healed page thumbnails   │
│  - draftRows (imported, overrides, eff.) │  │                                   │
│  - approvedSnapshots & approvedRecipients│  │  (Zero recipient PDFs stored!)     │
└──────────────────────────────────────────┘  └───────────────────────────────────┘
```

---

## The Zero-Cloud Invariant & Web Worker Generation

Traditional bulk document tools render recipient files on remote servers and store thousands of temporary PDFs in object buckets, creating substantial egress costs, storage bloat, and privacy risks.

EmitDocs adheres to an explicit **Zero Cloud Storage for Recipient PDFs** invariant:

1. **One-Time Base Asset Retrieval:** The client downloads the base PDF template once via an authorized, authenticated proxy endpoint (`GET /api/templates/:id/versions/:version/file`).
2. **Local Worker Processing:** The Web Worker draws dynamic values into new PDF documents in browser memory using transferable `ArrayBuffer` objects.
3. **Flat Memory Allocation (<150 MB):** Generated documents are streamed into `client-zip` and immediately garbage-collected. The worker does not retain document buffers in heap memory.
4. **Volume Splitting:** Generating batches of 5,000 documents never creates a massive multi-gigabyte browser download. The partitioner divides outputs into discrete 1,000-item ZIP archives (`part-1.zip`, `part-2.zip`).
5. **Absolute Privacy:** Personal data from the spreadsheet is mapped to PDFs solely on the user's local machine; recipient PDFs never travel across the network.

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
| **Archive Streaming**| `client-zip` 2.5 | Spec-compliant, in-memory zero-copy ZIP generation |
| **Data Parsing** | `papaparse` + `xlsx` (SheetJS) | Fast, client-side CSV and Excel workbook ingestion |
| **UI Primitives** | Radix UI Primitives | Accessible Select, Tooltip, Popover, Slot components |
| **Icons** | Phosphor Icons & Lucide React | Clean, scalable visual language |
| **Motion** | `motion` 14.1 | Micro-interactions and animated progress transitions |

### Backend API (`api/`)
| Component | Technology | Rationale / Implementation |
| :--- | :--- | :--- |
| **Server Framework**| Hono 4.4 on Node.js / Vercel | Lightweight, ultra-fast, standards-compliant routing |
| **Database** | MongoDB 7.7 + Mongoose 8.4 | Scalable document storage, atomic operations, TTL indexes |
| **Authentication** | Better-Auth 1.7 + Mongo Adapter | Google Identity OAuth, secure session cookies, CSRF guards |
| **Media Storage** | Cloudinary 2.11 | Signed base PDF storage, dual asset streaming, thumbnails |
| **Validation** | Zod 3.23 + `@hono/zod-validator` | Strict runtime request parsing and type inference |
| **Environment** | Dotenv | Configuration management across development and production |

### Testing & Verification (`test/`)
| Component | Technology | Scope |
| :--- | :--- | :--- |
| **Runtime Execution**| `tsx` (TypeScript Execute) | Fast, compilation-free test execution |
| **Linter** | Oxlint 1.81 | Ultra-fast Rust-based static analysis |
| **Assertions** | Node.js `node:assert/strict` | Zero-dependency, deterministic unit & matrix assertions |

---

## Repository Structure

```text
EmitDocs/
├── api/                             # Backend API service (Hono)
│   ├── api/index.ts                 # Vercel serverless entry point
│   ├── src/
│   │   ├── auth.ts                  # Better-Auth configuration & adapter
│   │   ├── controllers/             # HTTP transport controllers
│   │   │   ├── batches.controller.ts
│   │   │   ├── health.controller.ts
│   │   │   ├── storage.controller.ts
│   │   │   └── templates.controller.ts
│   │   ├── lib/                     # Database, Cloudinary & utility clients
│   │   ├── middleware/              # Authentication session middleware
│   │   ├── models/                  # Mongoose data schemas
│   │   │   ├── ApprovedRecipient.ts # Frozen recipient record
│   │   │   ├── ApprovedSnapshot.ts  # Sealed immutable batch snapshot
│   │   │   ├── Batch.ts             # Central batch lifecycle state model
│   │   │   ├── BatchImport.ts       # Spreadsheet intake revision
│   │   │   ├── DraftRow.ts          # Granular row data (imported + overrides)
│   │   │   ├── Template.ts          # Root template metadata
│   │   │   └── TemplateVersion.ts   # Immutable versioned mappings
│   │   ├── routes/                  # Sub-routers (/templates, /batches, /storage)
│   │   └── services/                # Deep domain business logic
│   │       ├── batch-approval.ts    # Canonical digest & snapshot engine
│   │       ├── batch-intake.ts      # Chunk ingestion & deduplication
│   │       ├── cloudinary-cleanup.ts# Orphan asset garbage collection
│   │       ├── spreadsheet/         # Diff calculators & row validators
│   │       └── template-lifecycle.ts# Versioning CAS & thumbnail health
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
│   │   │   ├── landing/             # Marketing landing page sections
│   │   │   ├── pwa/                 # Install cards & offline banners
│   │   │   ├── skeletons/           # Loading state skeleton primitives
│   │   │   ├── templates/           # Visual canvas & mapping tools
│   │   │   └── ui/                  # Primitives (Select, Tooltip, Toasts)
│   │   ├── hooks/                   # Custom React hooks (Worker, PWA, History)
│   │   ├── lib/                     # PDF engine, helpers & navigation
│   │   │   ├── batch-navigation.ts  # Centralized lifecycle routing helper
│   │   │   └── pdf-engine/          # Overlays, formatters, tokens, snapper
│   │   ├── routes/                  # TanStack Router file routes
│   │   │   ├── _protected/app/      # Protected dashboard, batches & templates
│   │   │   ├── index.tsx            # Public landing page
│   │   │   └── sign-in.tsx          # Google authentication screen
│   │   └── workers/                 # Dedicated background execution
│   │       ├── batch-generator.handler.ts # PDF generator loop & metrics
│   │       └── batch-generator.worker.ts  # Web Worker thread interface
│   ├── package.json
│   └── vite.config.ts
│
├── test/                            # Acceptance test suites & benchmark fixtures
│   ├── acceptance-matrix.test.ts    # PRD-CORE-03 visual mapping matrix
│   ├── batch-navigation.test.ts     # Lifecycle state navigation mappings
│   ├── core-04-acceptance-matrix.test.ts # Spreadsheet intake & 5k benchmark
│   ├── core-05-acceptance-matrix.test.ts # Draft review, search & diffing
│   ├── core-06-acceptance-matrix.test.ts # Snapshots, digests & CAS approval
│   ├── core-07-acceptance-matrix.test.ts # Web worker generation benchmarks
│   ├── pwa-features.test.ts         # Manifest and service worker validation
│   └── fixtures/                    # Test PDFs (fragmented tokens, rotated pages)
│
├── docs/                            # Specifications, PRDs and architecture logs
├── run.sh                           # Multi-process concurrent server launcher
├── package.json                     # Monorepo root scripts & test runners
└── README.md                        # Project documentation
```

---

## Environment Configuration

### Backend Configuration (`api/.env`)
Create a `.env` file inside the `api/` directory:

```ini
# Server Port & Environment
PORT=3000
NODE_ENV=development

# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017
DB_NAME=emitdocs

# Better-Auth Configuration
BETTER_AUTH_SECRET=your_32_character_random_secret_here
BETTER_AUTH_URL=http://localhost:3000

# Google OAuth Credentials (Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Cloudinary Storage Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# CORS Allowed Origins (Comma-separated for multiple domains)
CORS_ORIGIN=http://localhost:5173
```

### Frontend Configuration (`web/.env`)
Create a `.env` file inside the `web/` directory:

```ini
# Backend API Base URL
VITE_API_URL=http://localhost:3000
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
| `test:ac` | `pnpm run test:ac` | PRD-CORE-03: Visual token & field mapping |
| `test:core04` | `pnpm run test:core04` | PRD-CORE-04: Spreadsheet intake & 5,000-row benchmark |
| `test:core05` | `pnpm run test:core05` | PRD-CORE-05: Draft review, inline CAS edits & diff engine |
| `test:core06` | `pnpm run test:core06` | PRD-CORE-06: Approval preflight & immutable snapshot |
| `test:core07` | `pnpm run test:core07` | PRD-CORE-07: Web Worker generation (<20ms benchmark) |
| `test:nav` | `pnpm run test:nav` | Batch lifecycle state-to-route navigation matrix |
| `test:ui` | `pnpm run test:ui` | Radix Select accessible component primitives |
| `test:skeleton`| `pnpm run test:skeleton`| Skeleton loading state animations |
| `test:pwa` | `pnpm run test:pwa` | PWA manifest, service worker & offline handling |
| `test:toast` | `pnpm run test:toast` | Toast notification lifecycle & timers |
| `test:tooltip` | `pnpm run test:tooltip` | Tooltip positioning, flips & boundary clamping |
| `test:core10` | `pnpm run test:core10` | PRD-CORE-10: Pilot readiness, CI/CD, caps & drift matrix |
| `contract:check` | `pnpm run contract:check` | OpenAPI specification and contract drift check |

---

## Batch Lifecycle & Domain Invariants

A Batch progresses through an explicit, strictly guarded state machine:

```text
[draft] ───► [importing] ───► [review] ◄───► [awaiting_approval]
                                 │                   │
                                 │                   ▼
                                 │              [approved]
                                 │                   │
                                 │                   ▼
                                 │             [generating]
                                 │             (pause/resume)
                                 │                   │
                                 │                   ▼
                                 └──────────► [ready_for_download]
                                                     │
                                                     ▼
                                                [deleting]
```

### State-to-Route Navigation Mapping
Managed centrally by [`web/src/lib/batch-navigation.ts`](file:///run/media/jimfleax/DEV/Projects/EmitDocs/web/src/lib/batch-navigation.ts):
- **`draft` / `importing`:** Navigates to `/app/batches/:id/import` ("Continue Import")
- **`review`:** Navigates to `/app/batches/:id/review` ("Review Data")
- **`awaiting_approval`:** Navigates to `/app/batches/:id/approve` ("Approve Batch")
- **`approved` / `ready_for_download`:** Navigates directly to `/app/batches/:id/results` ("Download & Preview")
- **`generating` / `paused`:** Navigates to `/app/batches/:id/results` ("View Progress" / "Resume Generation")
- **`cancelled` / `failed`:** Routes to `/app/batches/:id/results` if an approved snapshot exists, else `/review`.

### Optimistic Concurrency Invariants
- **Templates:** Publishing a field mapping modification requires supplying the current `version`. The server increments the version counter via CAS; mismatched version numbers reject with `409 VersionConflictError`.
- **Draft Rows:** Inline edits (`patchDraftRow`) mandate matching row `version` numbers. Concurrent edits are safely rejected without overwriting unsaved changes.
- **Approval Seal:** When a batch is approved, an immutable `ApprovedSnapshot` is created with a canonical SHA-256 digest. If an edit or re-import occurs, the prior snapshot is superseded and the batch reverts to `review`.

---

## Security, Tenant Isolation & Retention

- **Authentication & Sessions:** Google OAuth with token signature verification on the backend via Better-Auth. Sessions are preserved in secure `HttpOnly`, `SameSite: Lax` cookies with dynamic origin whitelisting.
- **Tenant Isolation:** Every template, batch, row, and cloud asset operation strictly enforces ownership (`ownerId === session.user.id`). Cross-tenant access attempts return `404 Not Found` to prevent resource enumeration.
- **Storage Scoping:** Cloudinary uploads are strictly constrained to `templates/{userId}/...`. The backend signs explicit timestamps, folder paths, and public IDs—clients cannot upload to arbitrary destinations.
- **PII Minimization & Expiry:** Batch data retention is user-configurable (24h, 7d, 30d). Upon expiration, raw spreadsheet data and recipient records are purged from MongoDB, while reusable base PDF templates persist until deleted by the user.

---

## Release Boundary & Roadmap

### 1. Private Pilot Gates
The initial rollout of EmitDocs is gated exclusively for a closed Private Pilot cohort of verified event organizers and educators. The entry criteria to the private pilot are:
- Closed cohort testing under controlled volumes.
- Verified organizers with manually provisioned or pre-screened accounts.
- Local and staging proof before any production access.
- Direct operational monitoring and correlation-traced feedback.

### 2. ₹0 Public Hosting Blocker
Open public registration and unmoderated production hosting are strictly blocked until zero-cost public hosting constraints are formally certified.
- **Hosting Blocker**: Open self-registration and public internet launch are blocked until zero-cost SLA/egress guarantees (Vercel serverless + Cloudinary free tier + Atlas M0) are certified.
- EmitDocs operates on a free-tier hosting topology: Vercel serverless execution, Cloudinary free media tier (25GB storage / net credits), and MongoDB Atlas M0 free cluster.
- Open public self-registration without strict volume throttling or bot mitigation risks exhausting free-tier quotas and incurring cloud overages.
- Until resource ceilings, rate limiting, and zero-cost SLA guarantees are formally audited under production load, public self-signup remains disabled.

### 3. Core Operational Invariants in Pilot
- **Web Worker Rendering**: 100% of bulk PDF personalization and multi-volume ZIP creation occurs client-side in browser Web Workers.
- **Zero Recipient Cloud Storage**: Recipient PDFs are never stored in Cloudinary or MongoDB.
- **5,000 Row Intake Cap**: Hard limit of 5,000 rows per batch import (`MAX_BATCH_ROWS = 5000`).
- **15MB Template Size Cap**: Base PDF templates cannot exceed 15MB.
- **500MB Storage Quota Guard**: Tenant template storage is capped at 500MB.
- **Locked Email Dispatch Kill Switch**: Email dispatch is hard-disabled for this release (`ENABLE_EMAIL_DISPATCH = false`).

### 4. Pilot Testing Instructions
To execute the comprehensive pilot readiness acceptance matrix:
```bash
pnpm run test:core10
```
To check for OpenAPI contract drift against client types:
```bash
pnpm run contract:check
```

---

## License

This project is licensed under the [MIT License](LICENSE).
