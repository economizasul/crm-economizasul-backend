// models/Note.js
const { pool } = require('../config/db');

class Note {
    // ==========================================================
    // Criação automática da tabela se não existir
    // ==========================================================
    static async createTable() {
        const query = `
            CREATE TABLE IF NOT EXISTS notes (
                id SERIAL PRIMARY KEY,
                lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Vendedor que registrou
                type VARCHAR(50) NOT NULL, -- Ex: 'Ligação', 'Email', 'Nota', 'Reunião'
                content TEXT NOT NULL,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            -- Índices para performance
            CREATE INDEX IF NOT EXISTS notes_lead_id_idx ON notes (lead_id);
            CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes (user_id);
        `;
        try {
            await pool.query(query);
            console.log("✅ Tabela 'notes' verificada/criada com sucesso.");
        } catch (error) {
            console.error("❌ Erro ao criar tabela 'notes':", error);
            throw error;
        }
    }

    // ==========================================================
    // Buscar todas as notas de um lead
    // ==========================================================
    static async findByLeadId(leadId) {
        const query = `
            SELECT 
                n.*,
                u.name AS user_name,
                l.status AS lead_status
            FROM notes n
            JOIN leads l ON n.lead_id = l.id
            LEFT JOIN users u ON n.user_id = u.id
            WHERE n.lead_id = $1
            ORDER BY n.created_at DESC;
        `;
        try {
            const result = await pool.query(query, [leadId]);
            return result.rows;
        } catch (error) {
            console.error('Erro ao buscar notas por Lead ID:', error);
            throw error;
        }
    }

    // ==========================================================
    // Criar nova nota vinculada a um lead
    // ==========================================================
    static async create({ lead_id, user_id, type, content }) {
        const query = `
            INSERT INTO notes (lead_id, user_id, type, content)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        try {
            const result = await pool.query(query, [lead_id, user_id, type, content]);
            return result.rows[0];
        } catch (error) {
            console.error('Erro ao criar nota:', error);
            throw error;
        }
    }
}

module.exports = Note;
