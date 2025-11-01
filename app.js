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
// Configuração de CORS
// ===========================
const allowedOrigins = [
    // 🚨 ATUALIZE com os domínios do seu frontend
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
// Rota de autenticação
const authRoutes = require("./routes/authRoutes");
// Rota de Gestão de Usuários (nova/corrigida)
const userRoutes = require("./routes/userRoutes"); 
// Rota de Leads
const leadRoutes = require("./routes/leadRoutes");
// Rota de Clientes
const clientRoutes = require("./routes/clientRoutes");
// Rota de Pipeline/Kanban
const pipelineRoutes = require("./routes/pipelineRoutes");
// Rota de Relatórios (dashboard e exportação)
const reportsRoutes = require('./routes/reports');
// Rota de Configurações
const configuracoesRoutes = require('./routes/configuracoes');


// ===========================
// Registro de Rotas (todas usando o prefixo /api/v1)
// ===========================
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes); 
app.use("/api/v1/leads", leadRoutes);
app.use("/api/v1/clients", clientRoutes);
app.use("/api/v1/pipeline", pipelineRoutes);
app.use('/api/v1/reports', reportsRoutes); 
app.use('/api/v1/configuracoes', configuracoesRoutes);


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
// 👂 Iniciar o Servidor
// ===========================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`⚡️ Servidor rodando na porta ${PORT}`);
});

module.exports = app;