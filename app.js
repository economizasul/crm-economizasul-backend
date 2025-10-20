require('dotenv').config();
const express = require('express');
const cors = require('cors'); 
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/authRoutes');
const clientRoutes = require('./routes/clientRoutes');
const leadRoutes = require('./routes/leadRoutes');
const pipelineRoutes = require('./routes/pipelineRoutes');

const app = express();

// --- Configuração de Middlewares ---
const allowedFrontendUrl = 'https://crm-frontend-rbza.onrender.com';
app.use(cors({
    origin: allowedFrontendUrl, 
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


app.use(express.json());
app.use('/api/v1/auth', authRoutes); 
app.use('/api/clients', clientRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/pipelines', pipelineRoutes);

// Rota de teste simples
app.get('/', (req, res) => {
    res.send('CRM Backend API is running!');
});

// --- Inicialização do Servidor ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));