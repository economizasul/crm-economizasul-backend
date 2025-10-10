// models/Lead.js

const { pool } = require('../config/db');

class Lead {
    // 1. Cria a tabela de Leads se não existir
    static async createTable() {
        const query = `
            CREATE TABLE IF NOT EXISTS leads (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE,
                phone VARCHAR(20),
                status VARCHAR(50) DEFAULT 'Novo', 
                source VARCHAR(100),
                owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;
        try {
            await pool.query(query);
            console.log("Tabela 'leads' verificada/criada com sucesso.");
        } catch (error) {
            console.error("Erro ao criar tabela 'leads':", error);
        }
    }

    // 2. Cria um novo Lead
    static async create({ name, email, phone, status, source, owner_id }) {
        const query = `
            INSERT INTO leads (name, email, phone, status, source, owner_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;
        const values = [name, email, phone, status, source, owner_id];
        try {
            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error('Erro no modelo ao criar lead:', error);
            throw error;
        }
    }

    // 3. Busca TODOS os Leads (Usado pelo Admin)
    static async findAll() {
        const query = `
            SELECT * FROM leads ORDER BY created_at DESC;
        `;
        try {
            const result = await pool.query(query);
            return result.rows;
        } catch (error) {
            console.error('Erro no modelo ao buscar TODOS os leads:', error);
            throw error;
        }
    }


    // 4. Busca todos os Leads de um Dono Específico (Usado pelo User Padrão)
    static async findByOwner(ownerId) {
        const query = `
            SELECT * FROM leads WHERE owner_id = $1 ORDER BY created_at DESC;
        `;
        try {
            const result = await pool.query(query, [ownerId]);
            return result.rows;
        } catch (error) {
            console.error('Erro no modelo ao buscar leads por dono:', error);
            throw error;
        }
    }
    
    // 5. Busca Lead por ID
    static async findById(id) {
        const query = 'SELECT * FROM leads WHERE id = $1';
        try {
            const result = await pool.query(query, [id]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Erro no modelo ao buscar lead por ID:', error);
            throw error;
        }
    }

    // 6. Atualiza Lead (agora aceita owner_id para o Admin)
    static async update(id, { name, email, phone, status, source, owner_id }) {
        const query = `
            UPDATE leads
            SET name = $1, email = $2, phone = $3, status = $4, source = $5, owner_id = $6, updated_at = CURRENT_TIMESTAMP
            WHERE id = $7
            RETURNING *;
        `;
        // owner_id é o novo dono (se for admin) ou o dono existente.
        const values = [name, email, phone, status, source, owner_id, id];
        try {
            const result = await pool.query(query, values);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Erro no modelo ao atualizar lead:', error);
            throw error;
        }
    }

    // 7. Atualiza APENAS o status (usado no pipeline)
    static async updateStatus(id, newStatus) {
        const query = `
            UPDATE leads
            SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *;
        `;
        const values = [newStatus, id];
        try {
            const result = await pool.query(query, values);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Erro no modelo ao atualizar status do lead:', error);
            throw error;
        }
    }

    // 8. Exclui Lead
    static async delete(id) {
        const query = 'DELETE FROM leads WHERE id = $1 RETURNING *;';
        try {
            const result = await pool.query(query, [id]);
            return result.rowCount > 0;
        } catch (error) {
            console.error('Erro no modelo ao excluir lead:', error);
            throw error;
        }
    }
}

module.exports = Lead;