// app.js
// ===============================================
// Aplicação Backend CRM-EconomizaSul
// Configuração central de servidor, CORS e rotas
// ===============================================

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const reportsRouter = require('./routes/reports');


// Carrega variáveis de ambiente (.env)
dotenv.config();

// Inicializa app Express
const app = express();

// ===========================
// Configuração de CORS
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
// Importação de Rotas
// ===========================
const authRoutes = require("./routes/authRoutes");
// 🚨 NOVO: Rota de Gestão de Usuários
const userRoutes = require("./routes/userRoutes"); 
const leadRoutes = require("./routes/leadRoutes");
const clientRoutes = require("./routes/clientRoutes");
const pipelineRoutes = require("./routes/pipelineRoutes");
const configuracoesRoutes = require('./routes/configuracoes');

// ===========================
// Registro de Rotas
// ===========================
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes); 
app.use("/api/v1/leads", leadRoutes);
app.use("/api/v1/clients", clientRoutes);
app.use("/api/v1/pipeline", pipelineRoutes);
app.use('/api/v1/reports', require('./routes/reports'));
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/configuracoes', require('./routes/configuracoes'));

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
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;