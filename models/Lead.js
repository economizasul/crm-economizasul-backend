const { pool } = require('../config/db');

class Lead {
    // 1. Cria a tabela de Leads se não existir
    static async createTable() {
        const query = `
            CREATE TABLE IF NOT EXISTS leads (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(20) NOT NULL, 
                document VARCHAR(50), 
                address VARCHAR(255),
                status VARCHAR(50) DEFAULT 'Para Contatar', 
                origin VARCHAR(100),
                metadata JSONB DEFAULT '{}', 
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
            throw error;
        }
    }

    // 2. Cria um novo Lead
    static async create({ name, phone, document, address, origin, status, ownerId, uc, avgConsumption, estimatedSavings, notes }) {
        const metadata = {
            uc: uc,
            avgConsumption: avgConsumption,
            estimatedSavings: estimatedSavings,
            notes: notes || [],
        };

        const query = `
            INSERT INTO leads (name, phone, document, address, status, origin, owner_id, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *;
        `;
        const values = [name, phone, document, address, status, origin, ownerId, JSON.stringify(metadata)];

        try {
            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error('Erro no modelo ao criar lead:', error);
            throw error;
        }
    }

    // 3. Busca TODOS os Leads
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

    // 4. Busca todos os Leads de um Dono Específico
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

    // 6. Atualiza Lead
    static async update(id, { name, phone, document, address, origin, status, ownerId, uc, avgConsumption, estimatedSavings, notes }) {
        const metadata = {
            uc: uc,
            avgConsumption: avgConsumption,
            estimatedSavings: estimatedSavings,
            notes: notes || [],
        };

        const query = `
            UPDATE leads
            SET 
                name = $1, 
                phone = $2, 
                document = $3, 
                address = $4, 
                status = $5, 
                origin = $6, 
                owner_id = $7, 
                metadata = $8,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $9
            RETURNING *;
        `;

        const values = [name, phone, document, address, status, origin, ownerId, JSON.stringify(metadata), id];

        try {
            const result = await pool.query(query, values);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Erro no modelo ao atualizar lead:', error);
            throw error;
        }
    }

    // 7. Atualiza APENAS o status
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