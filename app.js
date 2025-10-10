// app.js - O Coração do Servidor

// 1. Carrega variáveis de ambiente
require('dotenv').config(); 

const express = require('express');
const { ensureTablesExist } = require('./config/db'); 

// IMPORTAÇÃO DE ROTAS
const authRoutes = require('./routes/authRoutes');
const leadRoutes = require('./routes/leadRoutes');
const clientRoutes = require('./routes/clientRoutes');
const pipelineRoutes = require('./routes/pipelineRoutes'); // NOVO

const app = express();
const port = process.env.PORT || 3000;

// -----------------------------------------------------
// 2. MIDDLEWARE (Configurações Globais)
// -----------------------------------------------------

app.use(express.json());

// -----------------------------------------------------
// 3. ROTAS DA API
// -----------------------------------------------------

// Rota de teste simples
app.get('/', (req, res) => {
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>CRM Economiza Sul: Backend Conectado!</title>
        </head>
        <body>
            <h1>CRM Economiza Sul: Backend Conectado!</h1>
            <p>O servidor está no ar e as tabelas (users, clients, leads) foram verificadas.</p>
            <p>Rotas disponíveis:</p>
            <ul>
                <li>/api/auth (Login/Registro)</li>
                <li>/api/leads (CRUD de Leads)</li>
                <li>/api/clients (CRUD de Clientes)</li>
                <li><strong>/api/pipeline/promote/:id (Promover Lead a Cliente)</strong></li>
            </ul>
            <p>Próximo passo: Testar o pipeline de conversão.</p>
        </body>
        </html>
    `;
    res.send(htmlContent);
});

// Rotas de Autenticação (Login/Registro) - Deve vir primeiro
app.use('/api/auth', authRoutes);

// Rotas de Dados (Protegidas)
app.use('/api/leads', leadRoutes); 
app.use('/api/clients', clientRoutes); 
app.use('/api/pipeline', pipelineRoutes); // NOVO

// -----------------------------------------------------
// 4. INICIA O SERVIDOR
// -----------------------------------------------------

// Primeiro, garante que as tabelas existem no banco, depois inicia o servidor
ensureTablesExist().then(() => {
    app.listen(port, () => {
        console.log(`🚀 Servidor rodando em http://localhost:${port}`);
    }).on('error', (err) => {
        console.error('Erro ao iniciar o servidor:', err);
    });
}).catch(err => {
    console.error('Falha ao iniciar o aplicativo devido a erro de banco de dados:', err);
});