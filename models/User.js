// models/User.js
const { pool } = require('../config/db');
const bcrypt = require('bcrypt'); // Importa o bcrypt para criptografia de senha

// Nível de segurança da criptografia (padrão 10)
const SALT_ROUNDS = 10; 

class User {
    // 1. Método para Criar um Novo Usuário (Vendedor)
    static async create({ name, email, password, role = 'sales' }) {
        try {
            // Criptografa a senha antes de enviar para o banco
            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
            
            const query = `
                INSERT INTO users (name, email, password, role)
                VALUES ($1, $2, $3, $4)
                RETURNING id, name, email, role, created_at
            `;
            const values = [name, email, hashedPassword, role];
            
            const result = await pool.query(query, values);
            return result.rows[0]; // Retorna o usuário recém-criado (sem a senha!)
        } catch (error) {
            // Erro comum: email duplicado
            if (error.code === '23505') { 
                throw new Error("Este e-mail já está cadastrado.");
            }
            throw new Error(`Erro ao criar usuário: ${error.message}`);
        }
    }

    // 2. Método para Buscar Usuário por E-mail (Usado no Login)
    static async findByEmail(email) {
        const query = 'SELECT * FROM users WHERE email = $1;';
        const result = await pool.query(query, [email]);
        return result.rows[0]; // Retorna o usuário com a senha criptografada
    }

    // 3. Método para Buscar Usuário por ID
    static async findById(id) {
        const query = 'SELECT id, name, email, role, created_at FROM users WHERE id = $1;';
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    // 4. Método Estático para Comparar Senhas
    static async comparePassword(plainPassword, hashedPassword) {
        // Retorna true ou false
        return bcrypt.compare(plainPassword, hashedPassword);
    }
}

module.exports = User;