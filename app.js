// app.js - O Coração do Servidor

// 1. Carrega variáveis de ambiente
require('dotenv').config();

const express = require('express');
const app = express();
const port = process.env.PORT || 3000; // Se estiver em produção, o Render usa a PORT dele

// IMPORTAÇÃO DE ROTAS (TODAS)
const authRoutes = require('./routes/authRoutes');
const leadRoutes = require('./routes/leadRoutes');
const clientRoutes = require('./routes/clientRoutes');
const pipelineRoutes = require('./routes/pipelineRoutes');

// 2. MIDDLEWARE (Configurações Globais)
app.use(express.json()); // Habilita o uso de JSON no corpo das requisições

// 3. USAR ROTAS
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/pipelines', pipelineRoutes);

// 4. INICIAR O SERVIDOR
app.listen(port, () => {
    console.log(`Server rodando na porta ${port}`);
});
// 
// Nota: Funções de migração e criação de tabelas (como ensureTablesExist) 
// foram removidas daqui para garantir a persistência dos dados.
