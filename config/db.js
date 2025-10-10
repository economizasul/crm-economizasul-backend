// config/db.js (DENTRO DA FUNÇÃO ensureTablesExist)

const bcrypt = require('bcryptjs');

const ensureTablesExist = async () => {
    try {
        // ... (Comandos DROP e CREATE para users, clients e leads)

        // Comando DROP para Leads (mantido para garantir a coluna owner_id)
        await pool.query(`DROP TABLE IF EXISTS leads CASCADE;`); // Adicione CASCADE para limpar dependências
        // Comando DROP para Clients (adicionamos para garantir FOREIGN KEY)
        await pool.query(`DROP TABLE IF EXISTS clients CASCADE;`);
        // Comando DROP para Users (adicionamos para garantir FOREIGN KEY)
        await pool.query(`DROP TABLE IF EXISTS users CASCADE;`);


        // 1. Tabela 'users'
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'user',
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        // 2. Tabela 'clients'
        await pool.query(`
            CREATE TABLE IF NOT EXISTS clients (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100),
                phone VARCHAR(50),
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        // 3. Tabela 'leads'
        await pool.query(`
            CREATE TABLE IF NOT EXISTS leads (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100),
                phone VARCHAR(50),
                status VARCHAR(50) DEFAULT 'Novo',
                source VARCHAR(100),
                owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);


        const checkUser = await pool.query(`SELECT id FROM users WHERE email = $1`, ['admin@economizasul.com']);
        
        if (checkUser.rows.length === 0) {

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('SenhaSegura123', salt);
            
            await pool.query(
                `INSERT INTO users (id, name, email, password, role)
                 VALUES (1, 'Admin Padrão', 'admin@economizasul.com', $1, 'admin')
                 ON CONFLICT (id) DO NOTHING`, 
                 [hashedPassword]
            );
            await pool.query(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));`);
            
            console.log("✅ Usuário admin@economizasul.com garantido (ID 1).");
        }


        console.log("Tabelas (users, clients, leads) verificadas/criadas com sucesso.");
    } catch (err) {
        console.error("ERRO FATAL: Não foi possível criar ou verificar as tabelas.", err);
        throw err; 
    }
};

