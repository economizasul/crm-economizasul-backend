// app.js - O Coração do Servidor

// 1. Carrega variáveis de ambiente
require('dotenv').config(); 

const express = require('express');
const { ensureTablesExist } = require('./config/db'); // Importa a função de verificação do banco
const clientRoutes = require('./routes/clientRoutes');
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

// Rota de teste simples (a mesma que já está no Render, agora limpa)
app.get('/', (req, res) => {
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>CRM Economiza Sul: Estrutura Pronta!</title>
        </head>
        <body>
            <h1>CRM Economiza Sul: Estrutura Pronta!</h1>
            <p>O servidor está no ar. A lógica de conexão com o banco foi movida para config/db.js.</p>
            <p>Próximo passo: Criar a API de Clientes em /routes/clients.js</p>
        </body>
        </html>
    `;
    res.send(htmlContent);
});
app.get('/', (req, res) => {
// ...
});

app.use('/api/clients', clientRoutes); 

// FUTURAMENTE:
// app.use('/api/leads', leadRoutes);
// FUTURAMENTE:
// app.use('/api/clients', clientRoutes);
// app.use('/api/leads', leadRoutes);


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