// models/Client.js

const { pool } = require('../config/db');

class Client {
    // 1. Criar um novo cliente no banco de dados (CREATE)
    static async create({ name, email, phone, owner_id }) {
        try {
            const result = await pool.query(
                `INSERT INTO clients (name, email, phone, owner_id)
                 VALUES ($1, $2, $3, $4)
                 RETURNING *`,
                [name, email, phone, owner_id]
            );
            return result.rows[0];
        } catch (error) {
            console.error('Erro no Client.create:', error);
            throw new Error('Não foi possível criar o cliente.');
        }
    }

    // 2. Buscar todos os clientes (READ ALL)
    static async findAll() {
        try {
            const result = await pool.query(`SELECT * FROM clients ORDER BY created_at DESC`);
            return result.rows;
        } catch (error) {
            console.error('Erro no Client.findAll:', error);
            throw new Error('Não foi possível buscar a lista de clientes.');
        }
    }

    // 3. Buscar cliente por ID (READ ONE)
    static async findById(id) {
        try {
            const result = await pool.query(`SELECT * FROM clients WHERE id = $1`, [id]);
            return result.rows[0];
        } catch (error) {
            console.error('Erro no Client.findById:', error);
            throw new Error('Não foi possível buscar o cliente.');
        }
    }

    // 4. Atualizar um cliente (UPDATE)
    static async update(id, { name, email, phone }) {
        try {
            const result = await pool.query(
                `UPDATE clients
                 SET name = $1, email = $2, phone = $3
                 WHERE id = $4
                 RETURNING *`,
                [name, email, phone, id]
            );

            if (result.rows.length === 0) {
                return null; 
            }
            return result.rows[0];
        } catch (error) {
            console.error('Erro no Client.update:', error);
            throw new Error('Não foi possível atualizar o cliente.');
        }
    }

    // 5. Excluir um cliente (DELETE)
    static async delete(id) {
        try {
            const result = await pool.query(`DELETE FROM clients WHERE id = $1 RETURNING *`, [id]);
            return result.rows.length > 0;
        } catch (error) {
            console.error('Erro no Client.delete:', error);
            throw new Error('Não foi possível excluir o cliente.');
        }
    }
}

module.exports = Client;