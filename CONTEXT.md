# Supplier Collaboration Portal — AI Chat Context

> Paste this file at the start of a new chat to immediately context-load the project.

---

## What This Is

A **vendor-facing RFQ (Request for Quotation) response portal** that integrates with **Microsoft Dynamics 365 Finance & Supply Chain (F&SC)**. Suppliers receive a unique, time-limited URL (no login required) to view and respond to RFQs. Responses are written back to D365 via OData. Built by RSM as a B2B procurement presales demo.

---

## Live URLs

| Purpose | URL |
|---|---|
| Admin console | `https://portal.rsmd365.com/supplier-collaboration/admin` |
| Vendor portal | `https://portal.rsmd365.com/supplier-collaboration/rfq/<token>` |
| Health check | `https://portal.rsmd365.com/health` |
| Azure direct (no DNS) | `https://supplier-portal-wa-g9ccf7d7hwfdd3g0.canadacentral-01.azurewebsites.net` |

Deployed on **Azure App Service** (`supplier-portal-wa`, Canada Central).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite (port 5175 dev), React Router v6 |
| Styling | Tailwind CSS 3, PostCSS |
| Icons | lucide-react |
| HTTP | axios |
| Backend | Node.js, Express 4, TypeScript (port 3001) |
| D365 Auth | `@azure/msal-node` — client credentials (service principal) |
| D365 API | OData REST v4 |
| Email | nodemailer (Ethereal fallback in demo mode) |
| File uploads | multer (disk, 10 MB limit) |
| Tokens | uuid v4, in-memory Map |
| Security | helmet, cors |

---

## Architecture

```
D365 F&SC (OData REST) ◄───── Express Backend (Node/TS, :3001)
                                        │
                        ┌───────────────┼──────────────────────┐
                        │               │                       │
                  /api/rfq/*      /api/admin/*            /uploads/*
                                         ▲
                                         │ REST (axios)
                               React Frontend (Vite SPA)
                               Prod base: /supplier-collaboration/
```

- **Single-app deployment**: Express serves the Vite-built frontend from `frontend/dist` at the base path `/supplier-collaboration/`.
- **Demo mode** (`USE_MOCK_DATA=true`): all data served from in-memory mock; no live D365 required.
- **Live mode**: MSAL acquires a Bearer token; calls D365 OData entities: `PublishedRequestForQuotationHeaders`, `PublishedRequestForQuotationLines`, `RequestForQuotationReplyLines`, `RequestForQuotationReplyHeaders`, `Vendors`.
- File uploads are stored on the local disk at `backend/uploads/`. Two in-memory Maps index files by token and by line item.
- Tokens and slots are **purely in-memory** — no database.

---

## Key Data Types

### Backend (`backend/src/types/index.ts`)

```ts
Vendor            { vendorId, vendorName, email }
RFQLineItem       { itemNumber, itemId, description, quantity, unit, leadTimeDays, quotedUnitPrice, extendedPrice, notes? }
RFQData           { rfqNumber, rfqStatus, entryDate, expirationDate, customerApprovalStatus, buyerName, buyerPhone, buyerEmail, companyName, vendor, items, instructions? }
TokenRecord       { token, rfqId, rfqNumber, vendorId, vendorName, vendorEmail, createdAt, expiresAt, responseStatus, submittedAt?, lastResponse?, rfqSnapshot? }
PortalSlot        { slotId ('slot-1'…'slot-5'), label, status ('empty'|'active'|'closed'), rfqNumber?, rfqData?, vendors, updatedAt? }
SlotVendor        { vendorId, vendorName, email, token, portalUrl, responseStatus, emailSent }
ConfigureSlotRequest { label?, rfqNumber, rfqData, vendors[], sendEmails?, expiryDays? }
VendorResponsePayload { responseStatus, quoteValidDays, quotedDate, items, generalNotes? }
ResponseStatus    'replied' | 'declined' | 'no-reply' | 'pending'
rfqStatus         'LOGGED' | 'SENT' | 'RECEIVED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'
```

### Frontend (`frontend/src/types/rfq.ts`)

Mirrors the above and adds:
```ts
RFQMeta           { responseStatus, submittedAt?, expiresAt, quoteValidDays, quotedDate, generalNotes }
RFQPageData       { rfq: RFQData, meta: RFQMeta }
LineItemDraft     { itemId, itemNumber, leadTimeDays, quotedUnitPrice, extendedPrice, notes }
SubmitPayload     { responseStatus, quoteValidDays, quotedDate, items, generalNotes? }
Document          { name, path, uploadedAt }
```

---

## API Routes

### RFQ — `/api/rfq`

| Method | Path | Middleware | Purpose |
|---|---|---|---|
| GET | `/:token` | validateToken | Fetch RFQ + existing vendor reply |
| POST | `/:token/respond` | validateToken | Vendor submits/updates quote |
| GET | `/:token/documents` | validateToken | List token-level attachments |
| POST | `/:token/documents` | validateToken | Upload files (max 10, 10 MB each) |
| DELETE | `/:token/documents/:filename` | validateToken | Delete attachment |
| GET | `/:token/lines/:itemId/documents` | validateToken | List per-line attachments |
| POST | `/:token/lines/:itemId/documents` | validateToken | Upload per-line files |
| DELETE | `/:token/lines/:itemId/documents/:filename` | validateToken | Delete per-line attachment |

### Admin — `/api/admin`

| Method | Path | Purpose |
|---|---|---|
| GET | `/slots` | All 5 portal slots |
| GET | `/slots/:slotId` | Single slot (syncs response statuses) |
| POST | `/slots/:slotId/configure` | Configure slot: RFQ, vendors, generate tokens, optionally send emails |
| POST | `/slots/:slotId/send-emails` | Resend invite emails to all vendors |
| DELETE | `/slots/:slotId` | Reset slot to empty |
| GET | `/vendor-lookup/:vendorId` | Vendor lookup in D365 |
| GET | `/rfq-lookup/:rfqNumber` | RFQ lookup in D365 (header, lines, invited vendors) |
| GET | `/tokens` | Dump all tokens (debug) |
| GET | `/email-preview/:token` | Render invite email HTML in browser |

### Other

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | `{ status, mode, timestamp }` |
| GET | `/uploads/:filename` | Serve uploaded files |
| GET | `/supplier-collaboration/*` | SPA fallback → `index.html` |

---

## Services

**`D365Service`** (`backend/src/services/d365Service.ts`)
- Env vars: `D365_BASE_URL`, `D365_CLIENT_ID`, `D365_TENANT_ID`, `D365_CLIENT_SECRET`
- MSAL `acquireTokenByClientCredential()` → Bearer token on every request (via axios interceptor)
- Key methods: `getRFQ()`, `lookupVendor()`, `lookupRFQForAdmin()`, `submitVendorReply()`
- Falls back to mock/snapshot when `USE_MOCK_DATA=true` or credentials missing

**`TokenService`** (`backend/src/services/tokenService.ts`)
- In-memory `Map<string, TokenRecord>`, pre-seeded with `MOCK_TOKENS`
- Key methods: `generateTokens()`, `findToken()` (returns `null` if expired), `recordResponse()`, `getAllTokens()`
- Expiry default: `TOKEN_EXPIRY_DAYS` env var (default 30 days)

**`EmailService`** (`backend/src/services/emailService.ts`)
- Real SMTP when `SMTP_HOST` is set; otherwise Ethereal test account (logs preview URL)
- Key methods: `buildEmailHtml()`, `buildEmailText()`, `sendRFQInvite()`

**`SlotService`** (`backend/src/services/slotService.ts`)
- Manages 5 in-memory `PortalSlot` objects (`slot-1` through `slot-5`)
- Key methods: `getAll()`, `getById()`, `configure()`, `sendEmails()`, `syncResponseStatuses()`, `reset()`

---

## Middleware

**`validateToken`** (`backend/src/middleware/validateToken.ts`)
- Reads `req.params.token`, calls `tokenService.findToken()`
- Returns `401` if invalid/expired; otherwise sets `res.locals.tokenRecord`

---

## Frontend Pages & Components

### Pages

| Page | Route | Notes |
|---|---|---|
| `LandingPage` | `/` | Demo splash; 3 hardcoded vendor links for RFQ 000334 |
| `RFQPage` | `/rfq/:token` | Main vendor page; Response + Documents tabs; `LineItemDraft[]` state |
| `AdminPage` | `/admin` | 5 `SlotCard` sections for managing slots |
| `NotFound` | `*` | 404 catch-all |

### Components

| Component | Purpose |
|---|---|
| `Header` | Top nav: buyer company name, vendor identity, "Secure link" badge |
| `RFQInfo` | Metadata strip: RFQ #, supplier, status, dates, approval status |
| `ResponseStatusSelector` | 3-button toggle: `replied` / `declined` / `no-reply` |
| `ItemsTable` | Editable line items grid; lead time + unit price editable; extended price computed client-side; per-row `LineAttachmentPanel` |
| `DocumentUpload` | Drag-and-drop token-level file upload zone + file list |
| `LineAttachmentPanel` | Collapsible per-line-item file attachment panel (inline in `ItemsTable`) |
| `SuccessModal` | Post-submission confirmation modal |
| `SlotCard` (inline in AdminPage) | Full configure/view card per slot: RFQ lookup, vendor management, email send/resend, reset |

---

## Frontend API Service (`frontend/src/services/api.ts`)

Single axios instance. Base URL: `VITE_API_URL + '/api'` (prod) or `/api` (dev, proxied by Vite).

Methods: `getRFQ`, `submitResponse`, `getDocuments`, `uploadDocuments`, `deleteDocument`, `getLineDocuments`, `uploadLineDocuments`, `deleteLineDocument`, `getSlots`, `getSlot`, `configureSlot`, `sendSlotEmails`, `resetSlot`, `lookupRFQ`, `lookupVendor`

---

## Mock Data (`backend/src/data/mockData.ts`)

**RFQ `000334`** — buyer: Mike Smith, company: Stark Industries, 5 line items:
- HP server HDD, HP inkjet, Lenovo monitor stand, Lenovo T61, Maxtor external HDD

**Pre-seeded tokens:**

| Token | Vendor |
|---|---|
| `demo-token-flotech-001` | Flo-Tech (`VEND-001`) |
| `demo-token-techsol-002` | Tech Solutions Inc (`VEND-002`) |
| `demo-token-globsup-003` | Global Supplies Co (`VEND-003`) |

---

## Environment Variables

### Backend (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | Server port |
| `FRONTEND_URL` | `http://localhost:5173` | CORS origin + email link base |
| `FRONTEND_BASE_PATH` | `/supplier-collaboration` | Path where frontend is served |
| `USE_MOCK_DATA` | — | `'true'` = demo mode, no D365 calls |
| `D365_BASE_URL` | — | D365 instance base URL |
| `D365_CLIENT_ID` | — | Azure AD app client ID |
| `D365_TENANT_ID` | — | Azure AD tenant ID |
| `D365_CLIENT_SECRET` | — | Azure AD app client secret |
| `TOKEN_EXPIRY_DAYS` | `30` | Token lifetime in days |
| `SMTP_HOST` | — | SMTP server (absent = Ethereal fallback) |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_SECURE` | — | `'true'` for TLS/SSL |
| `SMTP_USER` | — | SMTP auth username |
| `SMTP_PASS` | — | SMTP auth password |
| `EMAIL_FROM` | — | Sender address/display |
| `EMAIL_PREVIEW` | — | `'true'` = skip send, log preview URL |

### Frontend (Vite)

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Absolute backend API URL for production |
| `VITE_COMPANY_NAME` | Pre-fills company name in admin configure form |

---

## NPM Scripts

```bash
# From repo root
npm run install:all       # Install all backend + frontend deps
npm run build             # build:frontend then build:backend
npm run start             # node dist/index.js (backend serves everything)

# Backend only
cd backend
npm run dev               # ts-node-dev --respawn --transpile-only src/index.ts
npm run build             # tsc
npm run start             # node dist/index.js

# Frontend only
cd frontend
npm run dev               # vite (port 5175, proxies /api → :3001)
npm run build             # tsc && vite build (output: frontend/dist)
npm run preview           # vite preview
```

---

## Key Files Quick Reference

| File | Purpose |
|---|---|
| `backend/src/index.ts` | Express app setup, middleware, static serving, route mounting |
| `backend/src/types/index.ts` | All shared backend TypeScript types |
| `backend/src/routes/rfq.ts` | Vendor-facing RFQ routes |
| `backend/src/routes/admin.ts` | Admin management routes |
| `backend/src/services/d365Service.ts` | D365 OData integration + MSAL auth |
| `backend/src/services/tokenService.ts` | Token lifecycle management |
| `backend/src/services/emailService.ts` | Email generation + sending |
| `backend/src/services/slotService.ts` | Portal slot management |
| `backend/src/middleware/validateToken.ts` | Token validation middleware |
| `backend/src/data/mockData.ts` | Demo RFQ + pre-seeded tokens |
| `backend/src/utils/dateUtils.ts` | `addDays`, `isExpired`, `formatDate` |
| `frontend/src/App.tsx` | React Router setup |
| `frontend/src/types/rfq.ts` | All shared frontend TypeScript types |
| `frontend/src/services/api.ts` | Axios API client |
| `frontend/src/pages/RFQPage.tsx` | Main vendor-facing page |
| `frontend/src/pages/AdminPage.tsx` | Admin console (SlotCards) |
| `frontend/vite.config.ts` | Vite config: base path, dev proxy |
| `docs/d365-rfq-email-template.html` | Email template reference |
