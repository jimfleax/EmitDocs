# User Cloud Storage Consumption API Specification

## 1. Overview
The Storage API provides real-time visibility into the volume of document assets stored in the cloud for an authenticated user. It powers the EmitDocs dashboard "Storage Consumed" metric, enabling users to monitor their storage utilization across active and archived template documents.

## 2. Architecture & Design Principles

### Hybrid Inspection Strategy
1. **Live Cloudinary Inspection**:
   - Queries Cloudinary Admin API (`cloudinary.api.resources`) under the user's isolated folder (`templates/{userId}/`).
   - Checks both `image` and `raw` resource types to discover all cloud assets.
   - Extracts live byte counts (`asset.bytes`), public IDs, formats, and creation timestamps.
2. **MongoDB Correlation & Fallback**:
   - Fetches the user's `Template` and `TemplateVersion` records from MongoDB.
   - Maps each cloud asset's `public_id` to its user-facing template name and identifies whether it belongs to a soft-deleted template (`deletedAt != null`).
   - If Cloudinary Admin API is unavailable, unconfigured, or rate-limited (HTTP 429), smoothly falls back to the byte counts tracked in `TemplateVersion` records.
   - If the user has templates in MongoDB that are not present in Cloudinary (e.g. mock test environments), database records are seamlessly merged so no legitimate usage is lost.

## 3. Endpoints

### `GET /api/storage` & `GET /api/storage/summary`
Retrieves the storage consumption summary and document breakdown for the authenticated user.

- **Authentication**: Required (`session.user` via Better Auth / `requireAuth` middleware)
- **Headers**:
  - `Accept: application/json`
  - `Cookie: <better-auth session cookies>`

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "totalBytes": 3670016,
  "formattedTotal": "3.5 MB",
  "documentCount": 3,
  "documents": [
    {
      "id": "templates/usr_1/cert_v1",
      "name": "Certificate of Excellence",
      "bytes": 1048576,
      "formattedSize": "1 MB",
      "format": "pdf",
      "resourceType": "image",
      "createdAt": "2026-10-12T10:00:00.000Z",
      "isSoftDeleted": false,
      "templateId": "6528f1e4b8a2c1..."
    },
    {
      "id": "templates/usr_1/diploma_v1",
      "name": "Archived Diploma",
      "bytes": 524288,
      "formattedSize": "512 KB",
      "format": "pdf",
      "resourceType": "image",
      "createdAt": "2026-10-10T08:30:00.000Z",
      "isSoftDeleted": true,
      "templateId": "6528e9a2b8a2c1..."
    }
  ],
  "source": "cloudinary"
}
```

#### Unauthorized Response (`401 Unauthorized`)
```json
{
  "error": "Unauthorized"
}
```

## 4. Frontend Integration
The dashboard route (`web/src/routes/_protected/app/index.tsx`) fetches `GET /api/storage` on mount.
- Displays a skeleton loader (`<Skeleton className="h-6 w-20 rounded-md mt-1" />`) while data is loading.
- Replaces the former hardcoded `14.2 MB` card with dynamic `formattedTotal` (e.g., `0 B` or `3.5 MB`).
- Displays a live document count subtitle (e.g., `3 documents stored`).
