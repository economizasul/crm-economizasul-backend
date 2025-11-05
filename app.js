// app.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const history = require('connect-history-api-fallback');

dotenv.config();
const app = express();

// CORS
const allowedOrigins = [
  "https://crm-frontend-static.onrender.com",
  "https://crm-frontend-rbza.onrender.com",
  "https://crm-front-renderer.onrender.com",
  "http://localhost:5173"
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('CORS não permitido'));
  },
  credentials: true
}));

app.use(express.json());

// Rotas
app.use("/api/v1/auth", require('./routes/authRoutes'));
app.use("/api/v1/leads", require('./routes/leadRoutes'));
app.use("/api/v1/clients", require('./routes/clientRoutes'));
app.use("/api/v1/pipeline", require('./routes/pipelineRoutes'));
app.use("/api/v1/reports", require('./routes/reports')); // ⬅️ Aqui está a importação
app.use("/api/v1/users", require('./routes/users'));
app.use("/api/v1/configuracoes", require('./routes/configuracoes'));

// SPA (React)
const frontendPath = path.join(__dirname, 'dist');
app.use(history({
  rewrites: [
    { from: /^\/api\/v1\/.*$/, to: ctx => ctx.parsedUrl.pathname }
  ]
}));
app.use(express.static(frontendPath));

// CORREÇÃO FINAL: ROTA WILDCARD COM app.use()
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Rota não encontrada' });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Health
app.get("/api/v1/health", (req, res) => res.json({ message: "API OK", status: "ok" }));

const PORT = process.env.PORT || 5000;
const pool = require("./db");
const User = require("./models/User");
const Lead = require("./models/Lead");

(async () => {
  try {
    await pool.query('SELECT 1');
    console.log("DB conectado");

    await User.createTable();
    await Lead.createTable();
    console.log("Tabelas OK");

    app.listen(PORT, () => console.log(`Servidor na porta ${PORT}`));
  } catch (err) {
    console.error("Falha na inicialização:", err);
    process.exit(1);
  }
})();