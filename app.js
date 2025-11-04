// app.js
// ===============================================
// Aplicação Backend CRM-EconomizaSul
// Configuração central de servidor, CORS e rotas
// ===============================================

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const history = require('connect-history-api-fallback');

// Rotas (agora dentro de /src)
const userRoutes = require('./src/routes/users');
const authRoutes = require('./src/routes/authRoutes');
const clientRoutes = require('./src/routes/clientRoutes');
const reportRoutes = require('./src/routes/reports');
const leadRoutes = require('./src/routes/leadRoutes');
const pipelineRoutes = require('./src/routes/pipelineRoutes');
const configRoutes = require('./src/routes/configuracoes');

// Modelos (para inicialização do banco)
const Lead = require("./src/models/Lead");
const User = require("./src/models/User");
const pool = require("./src/db/index");

// Carrega variáveis de ambiente (.env)
dotenv.config();

// Inicializa app Express
const app = express();

// ===========================
// Configuração de CORS
// ===========================
const allowedOrigins = [
  "https://crm-frontend-static.onrender.com",
  "https://crm-frontend-rbza.onrender.com",
  "https://crm-front-renderer.onrender.com",
  "http://localhost:5173",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("🚫 Bloqueado por CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Middleware para JSON
app.use(express.json());

// ===========================
// Registro de Rotas
// ===========================
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/leads", leadRoutes);
app.use("/api/v1/clients", clientRoutes);
app.use("/api/v1/pipeline", pipelineRoutes);
app.use("/api/v1/reports", reportRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/configuracoes", configRoutes);

// ===========================
// Lógica para SPA (React Router)
// ===========================
const frontendPath = path.join(__dirname, 'dist');

app.use(
  history({
    rewrites: [
      {
        from: /^\/api\/v1\/.*$/,
        to: (context) => context.parsedUrl.pathname,
      },
    ],
  })
);

app.use(express.static(frontendPath));

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ===========================
// Health Check
// ===========================
app.get("/api/v1/health", (req, res) => {
  res.json({
    message: "🚀 API CRM-EconomizaSul funcionando!",
    status: "ok",
  });
});

// Porta
const PORT = process.env.PORT || 5000;

// ==================================================
// Inicialização do servidor e banco
// ==================================================
async function initializeAndStartServer() {
  try {
    console.log("Iniciando a inicialização do servidor...");

    // 1. Teste de conexão ao DB
    await pool.query('SELECT 1');
    console.log("🔗 Conexão com o PostgreSQL OK.");

    // 2. Criação/Verificação das tabelas
    await User.createTable();
    await Lead.createTable();
    console.log("✅ Tabelas verificadas com sucesso.");

    // 3. Inicializa servidor
    app.listen(PORT, () => {
      console.log(`✅ Servidor rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error("❌ ERRO CRÍTICO NA INICIALIZAÇÃO DO SERVIDOR/DB:");
    console.error(error);
    process.exit(1);
  }
}

// Inicia o processo
initializeAndStartServer();

module.exports = app;
