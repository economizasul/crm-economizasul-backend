// models/Note.js
const { pool } = require('../db');

class Note {
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
            -- Índice para buscas rápidas por lead
            CREATE INDEX IF NOT EXISTS notes_lead_id_idx ON notes (lead_id);
            -- Índice para buscas rápidas por vendedor
            CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes (user_id);
        `;
        try {
            await pool.query(query);
            console.log("Tabela 'notes' verificada/criada com sucesso.");
        } catch (error) {
            console.error("Erro ao criar tabela 'notes':", error);
            throw error;
        }
    }

    // Método para buscar todas as notas de um lead específico
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
}

module.exports = Note;