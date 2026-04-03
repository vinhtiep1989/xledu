require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const adminRoutes = require('./admin.routes');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const publicDir = path.resolve(process.env.PUBLIC_DIR || path.join(__dirname, 'public'));
const configuredOrigins = String(process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

function applyCors(req, res, next) {
  const origin = req.headers.origin;

  if (!origin) {
    return next();
  }

  if (!configuredOrigins.length) {
    res.header('Access-Control-Allow-Origin', '*');
  } else if (configuredOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  } else {
    return res.status(403).json({
      error: 'CORS_ORIGIN_NOT_ALLOWED',
      origin
    });
  }

  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
}

function resolvePublicFile(...candidates) {
  for (const candidate of candidates) {
    const filePath = path.join(publicDir, candidate);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
}

app.disable('x-powered-by');
app.use(applyCors);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'xledu-admin-api',
    publicDirExists: fs.existsSync(publicDir)
  });
});

app.use('/api/admin', adminRoutes);

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

app.get('/', (req, res) => {
  const entryFile = resolvePublicFile('index.html', 'login.html');

  if (!entryFile) {
    return res.status(404).json({
      error: 'PUBLIC_ENTRY_NOT_FOUND',
      expectedFiles: ['index.html', 'login.html'],
      publicDir
    });
  }

  return res.sendFile(entryFile);
});

app.get(/^(?!\/api\/).*/, (req, res, next) => {
  if (path.extname(req.path)) {
    return next();
  }

  const spaEntryFile = resolvePublicFile('index.html', 'login.html');
  if (!spaEntryFile) {
    return next();
  }

  return res.sendFile(spaEntryFile);
});

app.use((req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    path: req.originalUrl
  });
});

app.use((error, req, res, next) => {
  console.error('Unhandled server error:', error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'Unexpected server error' : error.message
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Static public dir: ${publicDir}`);
});
