// models/Client.js
const { pool } = require('../config/db'); // Importa o pool de conexão que criamos

class Client {
    // Método Estático para Criar um Novo Cliente no banco (JÁ EXISTENTE)
    static async create({ name, email, phone }) {
        const query = `
            INSERT INTO clients (name, email, phone)
            VALUES ($1, $2, $3)
            RETURNING id, name, email, phone, created_at
        `;
        const values = [name, email, phone];
        
        try {
            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            throw new Error(`Erro ao criar cliente: ${error.message}`);
        }
    }

    // Método Estático para Listar Todos os Clientes (JÁ EXISTENTE)
    static async findAll() {
        const query = `
            SELECT id, name, email, phone, created_at
            FROM clients
            ORDER BY created_at DESC;
        `;
        const result = await pool.query(query);
        return result.rows;
    }
    
    // NOVO: Método para Buscar Cliente por ID
    static async findById(id) {
        const query = 'SELECT * FROM clients WHERE id = $1;';
        const result = await pool.query(query, [id]);
        return result.rows[0]; // Retorna o cliente ou undefined
    }

    // NOVO: Método para Atualizar um Cliente (Update)
    static async update(id, { name, email, phone }) {
        // Usa o operador COALESCE para atualizar o campo apenas se um novo valor for fornecido
        const query = `
            UPDATE clients
            SET name = COALESCE($2, name),
                email = COALESCE($3, email),
                phone = COALESCE($4, phone)
            WHERE id = $1
            RETURNING *;
        `;
        const values = [id, name, email, phone];
        const result = await pool.query(query, values);
        return result.rows[0]; // Retorna o cliente atualizado
    }

    // NOVO: Método para Deletar um Cliente
    static async delete(id) {
        const query = 'DELETE FROM clients WHERE id = $1 RETURNING id;';
        const result = await pool.query(query, [id]);
        return result.rows[0]; // Retorna o ID do cliente deletado
    }
}

module.exports = Client;