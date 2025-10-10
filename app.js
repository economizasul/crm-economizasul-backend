// app.js - O Coração do Servidor

// 1. Carrega variáveis de ambiente
require('dotenv').config(); 

const express = require('express');
const { ensureTablesExist } = require('./config/db'); // Importa a função de verificação do banco
const clientRoutes = require('./routes/clientRoutes');
const authRoutes = require('./routes/authRoutes'); // NOVO: Importa a rota de autenticação

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
            <p>O servidor está no ar e as tabelas (clients e users) foram verificadas.</p>
            <p>Acesse <a href="/api/clients">/api/clients</a> para testar a rota de listagem.</p>
            <p>Próximo passo: Testar Login e Registro (API em /api/auth).</p>
        </body>
        </html>
    `;
    res.send(htmlContent);
});

// Rotas de Autenticação (Login/Registro) - DEVE VIR ANTES de clients, por segurança.
app.use('/api/auth', authRoutes);

// Rotas de Clientes (CRUD)
app.use('/api/clients', clientRoutes); 

// -----------------------------------------------------
// 4. INICIA O SERVIDOR
// -----------------------------------------------------

// Primeiro, garante que as tabelas existem no banco, depois inicia o servidor
ensureTablesExist().then(() => {
    app.listen(port, () => {
        console.log(`Servidor Node.js rodando na porta ${port}`);
    });
}).catch(err => {
    console.error("ERRO FATAL: Não foi possível iniciar o servidor após a verificação do banco.", err);
});