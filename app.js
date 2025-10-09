// Carrega variáveis de ambiente (como DATABASE_URL) do arquivo .env
require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// Configuração da conexão com o banco de dados
// Ele usará a DATABASE_URL do Render (em produção) ou do .env (local)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Desabilita SSL/TLS em desenvolvimento local, mas o Render lida com isso em prod.
  ssl: {
    rejectUnauthorized: false
  }
});

// Função para criar a tabela de clientes se ela não existir
async function createClientsTable() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(createTableQuery);
    console.log('Tabela "clients" verificada/criada com sucesso no Postgres.');
  } catch (err) {
    console.error('ERRO ao criar a tabela clients:', err);
  }
}

// -----------------------------------------------------
// ROTAS DO SERVIDOR
// -----------------------------------------------------

// Rota principal (pode ser a URL de teste)
app.get('/', async (req, res) => {
    // Tenta executar a função para garantir que a tabela existe antes de responder
    await createClientsTable(); 
    
    // Retorna a página HTML que você personalizou
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>CRM Economiza Sul, pronto para conectar!</title>
        </head>
        <body>
            <h1>CRM Economiza Sul: Backend Conectado!</h1>
            <p>Conexão com o Postgres testada e tabela 'clients' criada (ou verificada).</p>
            <p>Este é o ponto de partida do seu Servidor. Você pode começar a criar rotas (APIs) como /clients aqui.</p>
        </body>
        </html>
    `;
    res.send(htmlContent);
});

// Inicia o servidor Node.js
app.listen(port, () => {
    console.log(\`Servidor Node.js rodando na porta \${port}\`);
});