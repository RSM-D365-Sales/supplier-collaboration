import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { rfqRouter } from './routes/rfq';
import { adminRouter } from './routes/admin';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

// ─── Ensure uploads directory exists ─────────────────────────────────────────
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ─── Security & Parsing Middleware ────────────────────────────────────────────
// D365_FRAME_ANCESTORS: space-separated list of origins allowed to embed this
// portal in an iframe (e.g. your D365 F&O tenant URL).
// Example .env:  D365_FRAME_ANCESTORS=https://cd1.operations.dynamics.com
const frameAncestors = process.env.D365_FRAME_ANCESTORS
  ? `'self' ${process.env.D365_FRAME_ANCESTORS}`
  : `'self'`;

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow static file serving
    frameguard: false, // disable X-Frame-Options — controlled via CSP frame-ancestors instead
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],   // Vite bundles need this
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        frameAncestors: frameAncestors.split(' '),  // who can embed US in an iframe
      },
    },
  })
);
app.use(
  cors({
    origin: FRONTEND_URL,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '1mb' }));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/rfq', rfqRouter);
app.use('/api/admin', adminRouter);

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    mode: process.env.USE_MOCK_DATA === 'true' ? 'demo (mock data)' : 'live (D365)',
    timestamp: new Date().toISOString(),
  });
});

// ─── Serve built frontend (single-app deployment) ────────────────────────────
// Frontend is built with Vite base '/supplier-collaboration/', so assets and
// the SPA live under that path. Adjust FRONTEND_BASE_PATH if you change it.
const FRONTEND_BASE_PATH = process.env.FRONTEND_BASE_PATH ?? '/supplier-collaboration';
const frontendDist = path.join(__dirname, '../../frontend/dist');

if (fs.existsSync(frontendDist)) {
  // Static assets (hashed JS/CSS, images, etc.)
  app.use(FRONTEND_BASE_PATH, express.static(frontendDist));

  // SPA fallback: any non-API GET under the base path returns index.html
  app.get(`${FRONTEND_BASE_PATH}/*`, (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });

  // Optional convenience: redirect site root to the SPA
  app.get('/', (_req, res) => res.redirect(FRONTEND_BASE_PATH + '/'));

  console.log(`🖥️   Serving frontend from ${frontendDist} at ${FRONTEND_BASE_PATH}/`);
} else {
  console.warn(`⚠️   Frontend build not found at ${frontendDist} — API only.`);
}

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  const mode = process.env.USE_MOCK_DATA === 'true' ? 'DEMO MODE (mock data)' : 'LIVE MODE (D365)';
  console.log(`\n🚀  Supplier Portal API running on http://localhost:${PORT}`);
  console.log(`📋  Mode: ${mode}`);
  console.log(`\n📎  Demo vendor links (frontend must also be running):`);
  console.log(`   Flo-Tech        → ${FRONTEND_URL}/rfq/demo-token-flotech-001`);
  console.log(`   Tech Solutions  → ${FRONTEND_URL}/rfq/demo-token-techsol-002`);
  console.log(`   Global Supplies → ${FRONTEND_URL}/rfq/demo-token-globsup-003\n`);
});
