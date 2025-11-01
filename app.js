// app.js
// ===============================================
// Aplicação Backend CRM-EconomizaSul
// Configuração central de servidor, CORS e rotas
// ===============================================

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
// 🚨 NOVO: Middleware para History Fallback (para rotas do React Router)
const history = require('connect-history-api-fallback'); 


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


// ===================================
// LÓGICA PARA SPA (React Router) EM WEB SERVICE
// ===================================
// Define o caminho para a pasta de build do frontend (assumindo 'dist')
const frontendPath = path.join(__dirname, 'dist'); 

// 1. Middleware para reescrever as rotas (O History Fallback)
// Ele intercepta rotas não-API e as reescreve internamente para index.html
app.use(history({
    // Isso é crucial: garante que chamadas para /api/v1/* NÃO sejam reescritas
    rewrites: [
        {
            from: /^\/api\/v1\/.*$/,
            to: (context) => context.parsedUrl.pathname
        }
    ]
}));

// 2. Serve os arquivos estáticos da pasta de build ('dist')
// O Render irá usar este middleware para servir o index.html após a reescrita acima
app.use(express.static(frontendPath));

// 3. Fallback Final (Opcional, mas robusto): Garante que a raiz do frontend é o index.html
app.get('*', (req, res) => {
    // Apenas se a requisição não for para a API, sirva o index.html
    if (!req.url.startsWith('/api')) {
        res.sendFile(path.resolve(frontendPath, 'index.html'));
    } else {
        // Se for para a API e não caiu em nenhuma rota anterior (404 API), retorna 404
        res.status(404).json({ message: 'Recurso da API não encontrado.' });
    }
});


// ===========================
// 🩺 Health Check (teste rápido)
// ===========================
app.get("/api/v1/health", (req, res) => {
    res.json({
        message: "🚀 API CRM-EconomizaSul funcionando!",
        status: "ok",
    });
});

// Define a porta
const PORT = process.env.PORT || 5000;

// Inicia o Servidor
app.listen(PORT, () => {
    console.log(`✅ Servidor rodando na porta ${PORT}`);
});

module.exports = app;