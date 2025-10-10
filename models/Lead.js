// models/Lead.js

const { pool } = require('../config/db');

class Lead {
    // 1. Criar um novo Lead
    static async create({ name, email, phone, status, source, owner_id }) {
        try {
            const result = await pool.query(
                `INSERT INTO leads (name, email, phone, status, source, owner_id)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`,
                [name, email, phone, status, source, owner_id]
            );
            return result.rows[0];
        } catch (error) {
            console.error('Erro no Lead.create:', error);
            throw new Error('Não foi possível criar o Lead.');
        }
    }

    // 2. Buscar todos os Leads
    static async findAll() {
        try {
            const result = await pool.query(`SELECT * FROM leads ORDER BY created_at DESC`);
            return result.rows;
        } catch (error) {
            console.error('Erro no Lead.findAll:', error);
            throw new Error('Não foi possível buscar a lista de Leads.');
        }
    }

    // 3. Buscar Lead por ID
    static async findById(id) {
        try {
            const result = await pool.query(`SELECT * FROM leads WHERE id = $1`, [id]);
            return result.rows[0];
        } catch (error) {
            console.error('Erro no Lead.findById:', error);
            throw new Error('Não foi possível buscar o Lead.');
        }
    }

    // 4. Atualizar um Lead (dados gerais)
    static async update(id, { name, email, phone, status, source }) {
        try {
            const result = await pool.query(
                `UPDATE leads
                 SET name = $1, email = $2, phone = $3, status = $4, source = $5
                 WHERE id = $6
                 RETURNING *`,
                [name, email, phone, status, source, id]
            );

            if (result.rows.length === 0) {
                return null;
            }
            return result.rows[0];
        } catch (error) {
            console.error('Erro no Lead.update:', error);
            throw new Error('Não foi possível atualizar o Lead.');
        }
    }
    
    // 5. Atualizar apenas o Status do Lead (Usado no Pipeline)
    static async updateStatus(id, newStatus) {
        try {
            const result = await pool.query(
                `UPDATE leads
                 SET status = $1
                 WHERE id = $2
                 RETURNING *`,
                [newStatus, id]
            );
            return result.rows[0];
        } catch (error) {
            console.error('Erro no Lead.updateStatus:', error);
            throw new Error('Não foi possível atualizar o status do Lead.');
        }
    }

    // 6. Excluir um Lead
    static async delete(id) {
        try {
            const result = await pool.query(`DELETE FROM leads WHERE id = $1 RETURNING *`, [id]);
            return result.rows.length > 0;
        } catch (error) {
            console.error('Erro no Lead.delete:', error);
            throw new Error('Não foi possível excluir o Lead.');
        }
    }
}

module.exports = Lead;