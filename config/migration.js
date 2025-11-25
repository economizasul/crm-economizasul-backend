// config/migration.js - Script para garantir que a tabela 'users' tenha a coluna 'role'

const { pool } = require('./db');

// Esta função verifica se a coluna 'role' existe e a adiciona se for o caso
async function checkAndAddRoleColumn() {
    try {
        console.log("Verificando se a coluna 'role' existe na tabela 'users'...");

        // 1. Tenta selecionar a coluna 'role' da tabela 'users'
        const result = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='users' AND column_name='role';
        `);

        // 2. Se a coluna NÃO existir (result.rowCount é 0), a adiciona
        if (result.rowCount === 0) {
            console.log("Coluna 'role' não encontrada. Adicionando coluna...");
            
            await pool.query(`
                ALTER TABLE users 
                ADD COLUMN role VARCHAR(50) DEFAULT 'user';
            `);
            
            console.log("Coluna 'role' adicionada com sucesso. Definindo usuário 1 como 'admin'...");

            // 3. Define o primeiro usuário (seu Admin) como 'admin' por padrão
            await pool.query(`
                UPDATE users
                SET role = 'admin'
                WHERE id = 1;
            `);
            
            console.log("Usuário de ID 1 definido como 'admin'. Colunas migradas.");
        } else {
            console.log("Coluna 'role' já existe. Migração não necessária.");
        }
    } catch (error) {
        console.error("Erro durante a migração (checkAndAddRoleColumn):", error);
    }
}

module.exports = { checkAndAddRoleColumn };