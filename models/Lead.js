// models/Lead.js

// Importa a conexão com o banco de dados
const { pool } = require('../config/db');

class Lead {
    
    // 1. CRIAR NOVO LEAD (POST)
    static async create({ name, email, phone, status, source, owner_id }) {
        try {
            const result = await pool.query(
                `INSERT INTO leads (name, email, phone, status, source, owner_id)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`,
                [name, email, phone, status || 'Novo', source, owner_id]
            );
            return result.rows[0];
        } catch (error) {
            console.error('Erro no Model: create Lead', error);
            throw new Error('Não foi possível criar o Lead.');
        }
    }

    // 2. BUSCAR TODOS OS LEADS (GET)
    static async findAll() {
        try {
            const result = await pool.query('SELECT * FROM leads ORDER BY created_at DESC');
            return result.rows;
        } catch (error) {
            console.error('Erro no Model: findAll Leads', error);
            throw new Error('Não foi possível buscar os Leads.');
        }
    }

    // 3. BUSCAR LEAD POR ID (GET /:id)
    static async findById(id) {
        try {
            const result = await pool.query('SELECT * FROM leads WHERE id = $1', [id]);
            return result.rows[0];
        } catch (error) {
            console.error('Erro no Model: findById Lead', error);
            throw new Error('Não foi possível buscar o Lead.');
        }
    }

    // 4. ATUALIZAR LEAD (PUT /:id)
    static async update(id, { name, email, phone, status, source, owner_id }) {
        try {
            const result = await pool.query(
                `UPDATE leads SET name = $1, email = $2, phone = $3, status = $4, source = $5, owner_id = $6
                 WHERE id = $7
                 RETURNING *`,
                [name, email, phone, status, source, owner_id, id]
            );
            return result.rows[0];
        } catch (error) {
            console.error('Erro no Model: update Lead', error);
            throw new Error('Não foi possível atualizar o Lead.');
        }
    }

    // 5. EXCLUIR LEAD (DELETE /:id)
    static async delete(id) {
        try {
            const result = await pool.query('DELETE FROM leads WHERE id = $1 RETURNING *', [id]);
            return result.rows[0];
        } catch (error) {
            console.error('Erro no Model: delete Lead', error);
            throw new Error('Não foi possível deletar o Lead.');
        }
    }
}

module.exports = Lead;