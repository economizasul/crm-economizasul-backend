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

// --- CONFIGURAÇÃO DE SEGURANÇA E MIDDLEWARES ---

// 1. Configuração do CORS
// Permitir conexões do localhost (para desenvolvimento) e da URL de produção.
const allowedOrigins = [
    'http://localhost:5173', // O seu frontend VITE
    'https://crm-app-cntt7.onrender.com', // Exemplo de URL de produção futura (se hospedar o frontend no Render)
];

const corsOptions = {
    origin: function (origin, callback) {
        // Permitir requisições sem origem (como apps mobile ou curl)
        if (!origin) return callback(null, true); 
        
        // Se a origem estiver na lista de permitidos ou for localhost, permitir
        if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('localhost')) {
            callback(null, true);
        } else {
            // Bloquear a requisição
            callback(new Error('Not allowed by CORS'), false);
        }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// 2. Proteção de Cabeçalhos HTTP
app.use(helmet());

// 3. Limite de requisições (para proteção contra ataques de força bruta)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Limite de 100 requisições por IP
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// 4. Body Parser (para receber JSON nas requisições)
app.use(express.json());

// --- ROTAS DA API ---

app.get('/api', (req, res) => {
    res.send('API CRM está online.');
});

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/pipeline', pipelineRoutes);

// --- INÍCIO DO SERVIDOR ---

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
