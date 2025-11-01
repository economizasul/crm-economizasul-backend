// app.js
// ===============================================
// Aplicação Backend CRM-EconomizaSul
// Configuração central de servidor, CORS e rotas
// ===============================================

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const history = require('connect-history-api-fallback'); // Para SPA React

// Carrega variáveis de ambiente (.env)
dotenv.config();

// Inicializa app Express
const app = express();

// ===========================
// Configuração de CORS
// ===========================
const allowedOrigins = [
    "https://crm-frontend-static.onrender.com", // 🔹 Novo Static Site
    "https://crm-frontend-rbza.onrender.com",   // Antigo (opcional)
    "https://crm-front-renderer.onrender.com",  // Antigo (opcional)
    "http://localhost:5173"                     // Desenvolvimento local
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
const userRoutes = require("./routes/userRoutes"); 
const leadRoutes = require("./routes/leadRoutes");
const clientRoutes = require("./routes/clientRoutes");
const pipelineRoutes = require("./routes/pipelineRoutes");
const reportsRoutes = require('./routes/reports');
const configuracoesRoutes = require('./routes/configuracoes');

// ===========================
// Registro de Rotas
// ===========================
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes); 
app.use("/api/v1/leads", leadRoutes);
app.use("/api/v1/clients", clientRoutes);
app.use("/api/v1/pipeline", pipelineRoutes);
app.use('/api/v1/reports', reportsRoutes); 
app.use('/api/v1/configuracoes', configuracoesRoutes);

// ===========================
// LÓGICA PARA SPA (React Router) EM WEB SERVICE
// ===========================
const frontendPath = path.join(__dirname, 'dist'); 

// Middleware History Fallback para React Router
// 🚨 Importante: garante que rotas /api não sejam reescritas
app.use(history({
    rewrites: [
        {
            from: /^\/api\/v1\/.*$/,
            to: (context) => context.parsedUrl.pathname
        }
    ]
}));

// Serve arquivos estáticos do build
app.use(express.static(frontendPath));

// SPA fallback final (corrigido para não quebrar PathError)
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        // Se for rota de API, deixa passar para os handlers de API
        return next();
    }
    // Qualquer outra rota não encontrada: retorna index.html
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

// Inicia servidor
app.listen(PORT, () => {
    console.log(`✅ Servidor rodando na porta ${PORT}`);
});

module.exports = app;
