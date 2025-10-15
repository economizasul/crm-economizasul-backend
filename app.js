const express = require('express');
const cors = require('cors'); // Pacote para resolver o problema de conexão
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/authRoutes');
const clientRoutes = require('./routes/clientRoutes');
const leadRoutes = require('./routes/leadRoutes');
const pipelineRoutes = require('./routes/pipelineRoutes');
// Importa e configura o dotenv (deve ser o primeiro para carregar variáveis)
require('dotenv').config();

const app = express();

// --- Configuração de Middlewares ---
// 1. Configuração de CORS (Essencial para comunicação local/Render)
// O 'origin: *' permite que qualquer frontend (incluindo localhost:5173) se conecte.
app.use(cors({
    origin: '*', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
}));

// 2. Segurança (Helmet)
app.use(helmet());

// 3. Limite de requisições (Prevenção contra ataques)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Limita cada IP a 100 requisições por janela
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// 4. Body Parser (para aceitar JSON)
app.use(express.json());

// --- Rotas ---
// Rota de teste simples
app.get('/', (req, res) => {
    res.send('CRM Backend API is running!');
});

// Rotas da aplicação

// <<<<<<<< CORREÇÃO AQUI >>>>>>>>
// O prefixo foi alterado de '/api/auth' para '/api/v1/auth'
app.use('/api/v1/auth', authRoutes); 
app.use('/api/clients', clientRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/pipelines', pipelineRoutes);

// --- Inicialização do Servidor ---
// O Render define a porta automaticamente na variável de ambiente PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
