// src/services/UserService.js

const pool = require('../config/db'); // Garanta que seu pool de conexão esteja aqui
const bcrypt = require('bcryptjs'); 

const SALT_ROUNDS = 10; // Custo de hash para bcrypt

class UserService {

    /**
     * Cria um novo usuário no banco de dados.
     * @param {string} name - Nome do usuário.
     * @param {string} email - Email (deve ser único).
     * @param {string} password - Senha em texto simples.
     * @param {string} role - Papel ('admin' ou 'vendedor').
     */
    async createUser(name, email, password, role = 'vendedor') {
        // 1. Verificar se o usuário já existe
        const existingUser = await this.findUserByEmail(email);
        if (existingUser) {
            throw new Error('E-mail já está em uso.');
        }

        // 2. Hash da Senha
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // 3. Inserção no Banco de Dados
        const query = `
            INSERT INTO users (name, email, password_hash, role, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING id, name, email, role, created_at;
        `;
        const values = [name, email, hashedPassword, role];

        try {
            const result = await pool.query(query, values);
            // Retorna o usuário criado (sem a hash da senha)
            return result.rows[0];
        } catch (error) {
            console.error("Erro ao criar usuário:", error);
            // Lançar um erro genérico para o controller
            throw new Error('Falha ao registrar o usuário no banco de dados.');
        }
    }

    /**
     * Busca um usuário pelo email (usado para login e verificação de unicidade).
     */
    async findUserByEmail(email) {
        const query = 'SELECT * FROM users WHERE email = $1;';
        const result = await pool.query(query, [email]);
        return result.rows[0];
    }

    // Outros métodos (listar, atualizar, deletar) virão depois...
}

module.exports = new UserService();