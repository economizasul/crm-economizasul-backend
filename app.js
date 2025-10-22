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

const allowedOrigins = [
    'https://crm-frontend-rbza.onrender.com',
    'http://localhost:3000',
    'http://localhost:5173',
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
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
app.use('/api/v1/leads', leadRoutes);
app.use('/api/pipelines', pipelineRoutes);

app.get('/', (req, res) => {
    res.send('CRM Backend API is running!');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));