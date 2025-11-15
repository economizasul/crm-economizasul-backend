// app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const history = require('connect-history-api-fallback');

const { pool, ensureSchemaSafe } = require('./config/db');

const User = require('./models/User');
const Lead = require('./models/Lead');

const authRoutes = require('./routes/authRoutes');
const leadRoutes = require('./routes/leadRoutes');
const clientRoutes = require('./routes/clientRoutes');
const pipelineRoutes = require('./routes/pipelineRoutes');
const reportRoutes = require('./routes/reportRoutes');
const userRoutes = require('./routes/users');
const configuracoesRoutes = require('./routes/configuracoes');

const app = express();

app.use(express.json());

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'https://crm-frontend-static.onrender.com',
  'https://crm-frontend-rbza.onrender.com',
  'https://crm-front-renderer.onrender.com'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    return callback(new Error('CORS not allowed'));
  },
  credentials: true
}));

// rotas api
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/leads', leadRoutes);
app.use('/api/v1/clients', clientRoutes);
app.use('/api/v1/pipeline', pipelineRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/configuracoes', configuracoesRoutes);

// SPA static serve (se tiver build)
const frontendPath = path.join(__dirname, 'dist');

app.use(history({
  rewrites: [
    { from: /^\/api\/v1\/.*$/, to: ctx => ctx.parsedUrl.pathname }
  ]
}));

app.use(express.static(frontendPath));

// wildcard
app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Rota não encontrada' });
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// health
app.get('/api/v1/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5000;

// start sequence: verify DB connectivity and ensure schema (non-destructive)
(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('DB conectado');

    // ensure schema (creates missing tables only)
    await ensureSchemaSafe();

    // Also call model createTable (safe redundance)
    await User.createTable();
    await Lead.createTable();

    app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
  } catch (err) {
    console.error('Falha na inicialização:', err);
    process.exit(1);
  }
})();
