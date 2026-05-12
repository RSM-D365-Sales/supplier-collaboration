# Supplier Collaboration Portal

A vendor-facing RFQ (Request for Quotation) response portal that integrates with **Microsoft Dynamics 365 Finance & Supply Chain**. Each vendor receives a unique, secure token-based link to view and respond to their specific RFQ — no login required, designed for software demonstration.

---

## Architecture Overview

```
┌─────────────────────┐     unique link      ┌──────────────────────┐
│  D365 F&SC Workflow │  ──────────────────▶ │  Vendor Email Inbox  │
│  (Power Automate /  │  (3 vendors, 3 URLs) │  vendor@supplier.com │
│   Logic App)        │                      └──────────────────────┘
└────────┬────────────┘                                 │
         │ OData REST                                   │ clicks link
         ▼                                              ▼
┌─────────────────────┐    REST API     ┌──────────────────────────┐
│  Express.js Backend │ ◀────────────── │  React Frontend          │
│  (Node/TypeScript)  │ ──────────────▶ │  /rfq/:token             │
│  Port 3001          │                 │  Port 5173               │
└─────────────────────┘                 └──────────────────────────┘
         │
         │ OData PATCH (write-back)
         ▼
┌─────────────────────┐
│  D365 F&SC          │
│  PurchRFQReply*     │
└─────────────────────┘
```

## Unique Link Workflow

1. A **Business Event** or **Power Automate flow** in D365 F&SC detects a new RFQ and calls `/api/admin/generate-tokens`
2. The backend generates **one UUID token per vendor**, stores `{ rfqId, vendorId, vendorName, expiresAt }`
3. Vendors receive an email: `https://your-portal.com/rfq/<uuid-token>`
4. Visiting the link shows that vendor's name, RFQ details, and editable line items
5. On submission, the backend writes the response back to D365 via OData

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Routing | React Router v6 |
| Backend | Node.js + Express + TypeScript |
| D365 Auth | MSAL Node (Service Principal) |
| D365 API | OData REST (v4) |
| File Uploads | Multer |
| Tokens | UUID v4 |

---

## Project Structure

```
Supplier-collaboration-portal/
├── frontend/               # React + Vite app
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route-level page components
│   │   ├── services/       # API client
│   │   └── types/          # TypeScript interfaces
│   └── package.json
├── backend/                # Express API + D365 integration
│   ├── src/
│   │   ├── routes/         # API route handlers
│   │   ├── services/       # D365 OData client, token service
│   │   ├── middleware/     # Token validation
│   │   ├── data/           # Mock D365 data (demo mode)
│   │   └── types/          # Shared TypeScript types
│   └── package.json
└── README.md
```

---

## Quick Start (Demo Mode)

The backend ships with mock D365 data — no live D365 instance required for demo.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

### 3. Demo Vendor Links

Three vendors are pre-seeded for RFQ **000334**:

| Vendor | Token URL |
|--------|-----------|
| Flo-Tech | `http://localhost:5173/rfq/demo-token-flotech-001` |
| Tech Solutions Inc | `http://localhost:5173/rfq/demo-token-techsol-002` |
| Global Supplies Co | `http://localhost:5173/rfq/demo-token-globsup-003` |

---

## D365 Finance & Supply Chain Integration

### Authentication

Service-to-service via Azure AD application registration:

1. Register an app in Azure AD
2. Grant `Dynamics CRM` API permissions
3. Add the app as a **D365 user** with the `Accounts payable clerk` role
4. Set environment variables in `backend/.env`

### Key OData Entities

| Entity | Purpose |
|--------|---------|
| `PurchRFQCaseTableEntities` | RFQ header data |
| `PurchRFQCaseLineEntities` | RFQ line items |
| `PurchRFQReplyTableEntities` | Vendor reply headers |
| `PurchRFQReplyLineEntities` | Vendor reply line items |
| `VendVendorV2Entities` | Vendor master data |

### Triggering the Email Workflow

In D365 F&SC, configure a **Business Event** on `PurchRFQCaseSent` or use **Power Automate** with the D365 connector:

1. Trigger: When an RFQ is set to status "Sent to vendor"
2. For each vendor on the RFQ: call `POST /api/admin/generate-tokens`
3. Send the returned tokenized URL via email template

---

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=3001
FRONTEND_URL=http://localhost:5173

# D365 Connection (leave blank to use mock data)
D365_BASE_URL=https://your-org.operations.dynamics.com
D365_TENANT_ID=your-tenant-id
D365_CLIENT_ID=your-app-registration-client-id
D365_CLIENT_SECRET=your-client-secret

# Token settings
TOKEN_SECRET=your-random-secret-for-signing
TOKEN_EXPIRY_DAYS=30

# Demo mode (set to true to bypass D365 and use mock data)
USE_MOCK_DATA=true
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:3001
VITE_COMPANY_NAME=Stark Industries
```

---

## Deploying to Production (Azure)

Recommended Azure services:

- **Frontend**: Azure Static Web Apps (free tier) or Azure App Service
- **Backend**: Azure App Service (Node.js) or Azure Container Apps
- **Secrets**: Azure Key Vault
- **Files**: Azure Blob Storage (for document uploads)
- **Email**: Logic App → Office 365 connector

---

## Security Considerations

- Tokens are **UUID v4** (122 bits of entropy) — practically unguessable
- Tokens have a configurable expiry (default: 30 days)
- Each token is single-vendor: no cross-vendor data leakage
- All D365 credentials stored server-side only (never exposed to frontend)
- CORS restricted to the frontend origin in production
- File uploads validated for type and size
