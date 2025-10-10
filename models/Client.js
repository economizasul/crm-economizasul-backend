// models/Client.js
const { pool } = require('../config/db'); // Importa o pool de conexão que criamos

class Client {
    // Método Estático para Criar um Novo Cliente no banco
    static async create({ name, email, phone }) {
        const query = `
            INSERT INTO clients (name, email, phone)
            VALUES ($1, $2, $3)
            RETURNING id, name, email, phone, created_at
        `;
        const values = [name, email, phone];
        
        try {
            const result = await pool.query(query, values);
            return result.rows[0]; // Retorna o cliente recém-criado
        } catch (error) {
            // Este erro geralmente é de email duplicado (UNIQUE NOT NULL)
            throw new Error(`Erro ao criar cliente: ${error.message}`);
        }
    }

    // Método Estático para Listar Todos os Clientes
    static async findAll() {
        const query = `
            SELECT id, name, email, phone, created_at
            FROM clients
            ORDER BY created_at DESC;
        `;
        const result = await pool.query(query);
        return result.rows; // Retorna a lista de clientes
    }
    
    // Futuramente, adicionaremos métodos como findById, update e delete...
}

module.exports = Client;