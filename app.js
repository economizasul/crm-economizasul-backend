// app.js
// ===============================================
// Aplicação Backend CRM-EconomizaSul
// Configuração central de servidor, CORS e rotas
// ===============================================

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

// Carrega variáveis de ambiente (.env)
dotenv.config();

// Inicializa app Express
const app = express();

// ===========================
// 🔒 Configuração de CORS
// ===========================
const allowedOrigins = [
  "https://crm-frontend-rbza.onrender.com",
  "https://crm-front-renderer.onrender.com",
  "http://localhost:5173" // desenvolvimento local
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
// 📦 Importação de Rotas
// ===========================
const authRoutes = require("./routes/authRoutes");
const leadRoutes = require("./routes/leadRouters");
const clientRoutes = require("./routes/clientRoutes");
const pipelineRoutes = require("./routes/pipelineRoutes");

// ===========================
// 🚦 Registro de Rotas
// ===========================
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/leads", leadRoutes);
app.use("/api/v1/clients", clientRoutes);
app.use("/api/v1/pipeline", pipelineRoutes);

// ===========================
// 🩺 Health Check (teste rápido)
// ===========================
app.get("/", (req, res) => {
  res.json({
    message: "🚀 API CRM-EconomizaSul funcionando!",
    status: "ok",
  });
});

// ===========================
// 🖥️ Inicialização do servidor
// ===========================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});

module.exports = app;
