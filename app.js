// app.js - O Coração do Servidor

// 1. Carrega variáveis de ambiente
require('dotenv').config(); 

const express = require('express');

// Importações de Módulos e Configurações
const { ensureTablesExist } = require('./config/db'); // Importa a função de verificação do banco
const clientRoutes = require('./routes/clientRoutes');
const authRoutes = require('./routes/authRoutes');
const leadRoutes = require('./routes/leadRoutes'); // Importação das Rotas de Leads

const app = express();
const port = process.env.PORT || 3000;

// -----------------------------------------------------
// 2. MIDDLEWARE (Configurações Globais)
// -----------------------------------------------------

// Permite que o servidor entenda requisições com corpo JSON (essencial para API)
app.use(express.json());

// -----------------------------------------------------
// 3. ROTAS DA API
// -----------------------------------------------------

// Rota de teste simples (página inicial do servidor)
app.get('/', (req, res) => {
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>CRM Economiza Sul: Backend Conectado!</title>
        </head>
        <body>
            <h1>CRM Economiza Sul: Backend Conectado!</h1>
            <p>O servidor está no ar e as tabelas (users, clients e leads) foram verificadas.</p>
            <p>Rotas disponíveis:</p>
            <ul>
                <li>POST <a href="/api/auth/register">/api/auth/register</a></li>
                <li>POST <a href="/api/auth/login">/api/auth/login</a></li>
                <li>GET /api/clients (Protegida por JWT)</li>
                <li>GET /api/leads (Protegida por JWT)</li>
                <li>POST /api/leads (Protegida por JWT)</li>
            </ul>
        </body>
        </html>
    `;
    res.send(htmlContent);
});

// Rotas de Autenticação (Login/Registro) - DEVE VIR ANTES das rotas protegidas
app.use('/api/auth', authRoutes);

// Rotas de Clientes (CRUD)
app.use('/api/clients', clientRoutes); 

// Rotas de Leads (CRUD) ⬅️ INTEGRAÇÃO CORRIGIDA
app.use('/api/leads', leadRoutes); 

// -----------------------------------------------------
// 4. INICIA O SERVIDOR
// -----------------------------------------------------

// Primeiro, garante que as tabelas existem no banco, depois inicia o servidor
ensureTablesExist().then(() => {
    app.listen(port, () => {
        console.log(`🚀 Servidor rodando em http://localhost:${port}`);
    });
}).catch(error => {
    console.error("❌ FALHA AO INICIAR O SERVIDOR: Erro na conexão com o DB ou criação de tabelas.", error);
});
