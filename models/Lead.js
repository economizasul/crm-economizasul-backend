// models/Lead.js

const { pool } = require('../config/db');

class Lead {
    // 1. Cria a tabela de Leads se não existir (Mantida)
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
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
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

    // 2. Cria um novo Lead (Mantida)
    static async create({ 
        name, phone, document, address, status, origin, ownerId, 
        email, avgConsumption, estimatedSavings, notes, uc, qsa, lat, lng
    }) {
        const query = `
            INSERT INTO leads (
                name, phone, document, address, status, origin, owner_id, 
                email, uc, avg_consumption, estimated_savings, notes, qsa, lat, lng
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *;
        `;
        
        // A sanitização de NaN deve ocorrer no Controller, mas o modelo deve garantir a conversão segura para NULL
        const values = [
            name, phone, document, address, status, origin, ownerId, 
            email, uc, 
            avgConsumption ? parseFloat(avgConsumption) : null,
            estimatedSavings ? parseFloat(estimatedSavings) : null,
            notes, qsa, lat, lng
        ];
        
        try {
            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error("Erro no modelo ao criar lead:", error);
            throw error;
        }
    }

    // 3. Lista todos os Leads (com filtro por proprietário para User, ou todos para Admin)
    // 💡 CRÍTICO: Implementa o filtro de acesso.
    static async findAll(ownerId, isAdmin) {
        let query = `
            SELECT l.*, u.name as owner_name, u.email as owner_email
            FROM leads l
            LEFT JOIN users u ON l.owner_id = u.id
        `;
        const values = [];

        if (!isAdmin) {
            // Se não for Admin, filtra apenas pelos leads do usuário logado (owner_id)
            query += ' WHERE l.owner_id = $1';
            values.push(ownerId);
        } 
        
        query += ' ORDER BY l.updated_at DESC';

        try {
            const result = await pool.query(query, values);
            return result.rows;
        } catch (error) {
            console.error("Erro no modelo ao buscar todos os leads:", error);
            throw error;
        }
    }

    // 4. Busca lead por ID (Retorna o nome do proprietário)
    static async findById(id) {
        const query = `
            SELECT l.*, u.name as owner_name
            FROM leads l
            LEFT JOIN users u ON l.owner_id = u.id
            WHERE l.id = $1;
        `;
        try {
            const result = await pool.query(query, [id]);
            return result.rows[0] || null;
        } catch (error) {
            console.error("Erro no modelo ao buscar lead por ID:", error);
            throw error;
        }
    }

    // 5. Atualiza Lead (Completo)
    // 💡 CRÍTICO: Usa o ownerId que o Controller determinar (mantendo ou reatribuindo).
    static async update(id, { 
        name, phone, document, address, status, origin, 
        ownerId, // O ID do proprietário a ser salvo
        email, avgConsumption, estimatedSavings, notes, uc, qsa, lat, lng 
    }) {
        const query = `
            UPDATE leads
            SET 
                name = $1, phone = $2, document = $3, address = $4, status = $5, origin = $6, 
                owner_id = $7, updated_at = CURRENT_TIMESTAMP, 
                email = $8, uc = $9, avg_consumption = $10, estimated_savings = $11, 
                notes = $12, qsa = $13, lat = $14, lng = $15
            WHERE id = $16
            RETURNING *;
        `;
        const values = [
            name, phone, document, address, status, origin,
            ownerId,          // $7 -> ID do proprietário (mantido ou novo)
            email,            // $8
            uc,               // $9
            avgConsumption ? parseFloat(avgConsumption) : null, // $10
            estimatedSavings ? parseFloat(estimatedSavings) : null, // $11
            notes,            // $12
            qsa,              // $13
            lat,              // $14
            lng,              // $15
            id                // $16 (WHERE clause)
        ];

        try {
            const result = await pool.query(query, values);
            return result.rows[0] || null;
        } catch (error) {
            console.error(`Erro CRÍTICO no modelo Lead.update (ID: ${id}):`, error.message);
            throw error;
        }
    }

    // 6. Atualiza APENAS o status (mantida, mas não usada na correção do Kanban)
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

    // 7. Exclui Lead (Mantida)
    static async delete(id) { 
        const query = 'DELETE FROM leads WHERE id = $1 RETURNING id';
        try {
            const result = await pool.query(query, [id]);
            return result.rows.length > 0;
        } catch (error) {
            console.error('Erro no modelo ao excluir lead:', error);
            throw error;
        }
    }
}

module.exports = Lead;