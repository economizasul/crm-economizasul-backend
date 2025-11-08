// models/Lead.js
const { pool } = require('../db');

class Lead {
    static async createTable() {
        const query = `
            CREATE TABLE IF NOT EXISTS leads (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255),
                phone VARCHAR(20) NOT NULL, 
                document VARCHAR(50), 
                address VARCHAR(255),
                status VARCHAR(50) DEFAULT 'Novo', 
                origin VARCHAR(100),
                owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                uc VARCHAR(255),
                avg_consumption DOUBLE PRECISION,
                estimated_savings DOUBLE PRECISION,
                qsa TEXT,
                notes TEXT,
                lat NUMERIC,
                lng NUMERIC,
                metadata JSONB DEFAULT '{}',
                reason_for_loss VARCHAR(255), 
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                date_won TIMESTAMP WITHOUT TIME ZONE
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

    static async create({ 
        name, phone, document, address, status, origin, owner_id, 
        email, avg_consumption, estimated_savings, notes, uc, qsa, lat, lng,
        reason_for_loss
    }) {
        const query = `
            INSERT INTO leads (
                name, phone, document, address, status, origin, owner_id, 
                email, uc, avg_consumption, estimated_savings, notes, qsa, lat, lng,
                reason_for_loss
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *;
        `;
        const values = [
            name, phone, document, address, status || 'Novo', origin || 'Manual', owner_id,
            email || null, uc || null, 
            avg_consumption ? parseFloat(avg_consumption) : null,
            estimated_savings ? parseFloat(estimated_savings) : null,
            notes || null, qsa || null, lat || null, lng || null,
            reason_for_loss || null
        ];
        try {
            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error("Erro no modelo ao criar lead:", error);
            throw error;
        }
    }

    // MÉTODO CORRIGIDO 100% - AGORA FUNCIONA COM O CONTROLLER
    static async findAll({ status, ownerId, search, userRole }) {
        let query = `
            SELECT 
                l.*,
                u.name AS owner_name 
            FROM leads l
            LEFT JOIN users u ON l.owner_id = u.id 
            WHERE 1=1
        `;
        const values = [];
        let paramIndex = 1;

        // FILTRO POR STATUS
        if (status) {
            query += ` AND l.status = $${paramIndex}`;
            values.push(status);
            paramIndex++;
        }

        // FILTRO POR BUSCA
        if (search) {
            query += ` AND (
                l.name ILIKE $${paramIndex} OR 
                l.phone ILIKE $${paramIndex} OR 
                l.email ILIKE $${paramIndex} OR 
                l.document ILIKE $${paramIndex}
            )`;
            values.push(`%${search}%`);
            paramIndex++;
        }

        // FILTRAGEM POR DONO - CORRIGIDA E PERFEITA
        if (userRole !== 'Admin') {
            // VENDEDOR COMUM: SÓ VÊ OS PRÓPRIOS LEADS
            if (ownerId) {
                query += ` AND l.owner_id = $${paramIndex}`;
                values.push(ownerId);
                paramIndex++;
            }
        } else if (ownerId) {
            // ADMIN COM FILTRO: VÊ APENAS DO VENDEDOR ESPECÍFICO
            query += ` AND l.owner_id = $${paramIndex}`;
            values.push(ownerId);
            paramIndex++;
        }
        // ADMIN SEM FILTRO: VÊ TODOS

        query += ` ORDER BY l.created_at DESC`;

        try {
            const result = await pool.query(query, values);
            return result.rows;
        } catch (error) {
            console.error('Erro ao buscar leads (findAll):', error);
            throw error;
        }
    }

    static async findById(id) {
        const query = `
            SELECT 
                l.*,
                u.name AS owner_name 
            FROM leads l
            LEFT JOIN users u ON l.owner_id = u.id 
            WHERE l.id = $1;
        `;
        try {
            const result = await pool.query(query, [id]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Erro ao buscar lead por ID:', error);
            throw error;
        }
    }

    static async update(id, fields) {
        let query = 'UPDATE leads SET ';
        const values = [];
        let valueIndex = 1;
        const keys = Object.keys(fields);
        keys.forEach((key, index) => {
            query += `${key} = $${valueIndex}`;
            values.push(fields[key]);
            valueIndex++;
            if (index < keys.length - 1) query += ', ';
        });
        query += `, updated_at = CURRENT_TIMESTAMP WHERE id = $${valueIndex} RETURNING *;`;
        values.push(id);
        try {
            const result = await pool.query(query, values);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Erro ao atualizar lead:', error);
            throw error;
        }
    }

    static async delete(id) {
        const query = 'DELETE FROM leads WHERE id = $1 RETURNING *;';
        try {
            const result = await pool.query(query, [id]);
            return result.rows.length > 0;
        } catch (error) {
            console.error('Erro ao excluir lead:', error);
            throw error;
        }
    }

    static async getUsersForReassignment() {
        const query = 'SELECT id, name, role FROM users WHERE role IN (\'Admin\', \'User\') ORDER BY name;';
        try {
            const result = await pool.query(query);
            return result.rows;
        } catch (error) {
            console.error('Erro ao buscar usuários para reatribuição:', error);
            throw error;
        }
    }

    // Métricas do dashboard (mantidas, mas corrigidas para usar ownerId)
    static async getSimpleMetrics(userRole, ownerId) {
        let query = `SELECT COUNT(*) AS total FROM leads WHERE 1=1`;
        const values = [];
        if (userRole !== 'Admin') {
            query += ` AND owner_id = $1`;
            values.push(ownerId);
        }
        const result = await pool.query(query, values);
        return result.rows[0];
    }

}

module.exports = Lead;