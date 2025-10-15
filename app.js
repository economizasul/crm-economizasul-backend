const express = require('express');
const cors = require('cors'); 
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/authRoutes');
const clientRoutes = require('./routes/clientRoutes');
const leadRoutes = require('./routes/leadRoutes');
const pipelineRoutes = require('./routes/pipelineRoutes');
require('dotenv').config();

const app = express();

// --- Configuração de Middlewares ---
app.use(cors({
    origin: '*', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
}));
app.use(helmet());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, 
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// 4. Body Parser (DEVE VIR ANTES DAS ROTAS)
app.use(express.json());

// --- Rotas da Aplicação (DEVE VIR PRIMEIRO) ---
app.use('/api/v1/auth', authRoutes); 
app.use('/api/clients', clientRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/pipelines', pipelineRoutes);

// Rota de teste simples (DEVE VIR DEPOIS DAS ROTAS DA APLICAÇÃO)
app.get('/', (req, res) => {
    res.send('CRM Backend API is running!');
});

// --- Inicialização do Servidor ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));