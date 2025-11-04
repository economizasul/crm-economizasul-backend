// app.js
// ===============================================
// Aplicação Backend CRM-EconomizaSul
// Configuração central de servidor, CORS e rotas
// ===============================================

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const history = require('connect-history-api-fallback'); 
const { pool } = require('./config/db');

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
    "http://localhost:5173" 
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
// Importação de Rotas & Modelos
// ===========================
// Modelos (necessários para a inicialização)
const Lead = require("./models/Lead");
const User = require("./models/User"); 

const authRoutes = require("./routes/authRoutes");
// REMOVIDA A LINHA DUPLICADA: const userRoutes = require("./routes/userRoutes");
const leadRoutes = require("./routes/leadRoutes");
const clientRoutes = require("./routes/clientRoutes");
const pipelineRoutes = require("./routes/pipelineRoutes");
const reportsRoutes = require('./routes/reports');
const userRoutes = require('./routes/users'); // USANDO ESTA (APONTA PARA O CRUD)
const configuracoesRoutes = require('./routes/configuracoes');

// ===========================
// Registro de Rotas
// ===========================
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/leads", leadRoutes);
app.use("/api/v1/clients", clientRoutes);
app.use("/api/v1/pipeline", pipelineRoutes);
app.use('/api/v1/reports', reportsRoutes);
// CONSOLIDADO: Apenas um mapeamento para as rotas de usuário
app.use("/api/v1/users", userRoutes); 
app.use('/api/v1/configuracoes', configuracoesRoutes);

// ===========================
// LÓGICA PARA SPA (React Router) EM WEB SERVICE
// ===========================
const frontendPath = path.join(__dirname, 'dist'); 

// Middleware History Fallback para React Router
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

// SPA fallback final
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
// FUNÇÃO DE INICIALIZAÇÃO ROBUSTA (AGORA COMPLETA)
// ==================================================
async function initializeAndStartServer() {
    try {
        console.log("Iniciando a inicialização do servidor...");
        
        // 1. Conexão ao DB (apenas um teste)
        await pool.query('SELECT 1');
        console.log("🔗 Conexão com o PostgreSQL OK.");
        
        // 2. Criação/Verificação das tabelas (USERS DEVE SER CRIADA ANTES DE LEADS)
        await User.createTable(); // <-- RE-HABILITADO
        await Lead.createTable();
        
        console.log("✅ Inicialização do Banco de Dados concluída (tabelas 'users' e 'leads' verificadas).");

        // 3. Inicia servidor Express
        app.listen(PORT, () => {
            console.log(`✅ Servidor rodando na porta ${PORT}`);
        });

    } catch (error) {
        console.error("❌ ERRO CRÍTICO NA INICIALIZAÇÃO DO SERVIDOR/DB:");
        console.error(error);
        
        // Sair do processo se a inicialização falhar (Render vai reportar a falha)
        process.exit(1);
    }
}

// Inicia o processo
initializeAndStartServer();

module.exports = app;