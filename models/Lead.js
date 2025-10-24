// models/Lead.js

const { pool } = require('../config/db');

class Lead {
    // 1. Cria a tabela de Leads se não existir (Para novos ambientes)
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

    // 2. Cria um novo Lead
    static async create({ 
        name, phone, document, address, origin, status, ownerId, 
        email, uc, avgConsumption, estimatedSavings, notes, qsa, lat, lng 
    }) {
        const numericOwnerId = parseInt(ownerId, 10);
        
        // Query INSERT com 15 parâmetros (Colunas diretas)
        const query = `
            INSERT INTO leads (
                name, phone, document, address, origin, status, owner_id, 
                email, uc, avg_consumption, estimated_savings, notes, qsa, lat, lng
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *;
        `;
        
        // Array de Valores (15 parâmetros)
        const values = [
            name,                                     // $1
            phone,                                    // $2
            document,                                 // $3
            address,                                  // $4
            origin,                                   // $5
            status,                                   // $6
            numericOwnerId,                           // $7 (owner_id)
            email,                                    // $8
            uc,                                       // $9
            avgConsumption ? parseFloat(avgConsumption) : null, // $10 (double precision)
            estimatedSavings ? parseFloat(estimatedSavings) : null, // $11 (double precision)
            notes,                                    // $12 (text)
            qsa,                                      // $13 (text)
            lat,                                      // $14 (numeric)
            lng                                       // $15 (numeric)
        ];

        try {
            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error('Erro no modelo ao criar lead:', error);
            throw error;
        }
    }
    
    // 3. Busca Lead por ID
    static async findById(id) { 
        return await pool.query('SELECT * FROM leads WHERE id = $1', [id])
            .then(res => res.rows[0] || null); 
    }

    // 4. Busca todos os Leads
    static async findAll(ownerId = null, isAdmin = false) { 
        let query = 'SELECT * FROM leads';
        const params = [];

        if (!isAdmin && ownerId) {
            params.push(ownerId);
            query += ` WHERE owner_id = $${params.length}`; 
        }

        query += ' ORDER BY created_at DESC';
        return await pool.query(query, params).then(res => res.rows);
    }

    // 5. Atualiza Lead Completo - FOCO NO UPDATE COM COLUNAS DIRETAS
    static async update(id, { 
        name, phone, document, address, status, origin, ownerId, 
        email, uc, avgConsumption, estimatedSavings, notes, qsa, lat, lng
    }) {
        
        const numericOwnerId = parseInt(ownerId, 10);
        
        // Query SQL: Mapeando TODAS as colunas diretas
        const query = `
            UPDATE leads
            SET name = $1, phone = $2, document = $3, address = $4, status = $5, origin = $6, owner_id = $7,
                email = $8, uc = $9, avg_consumption = $10, estimated_savings = $11, notes = $12, qsa = $13,
                lat = $14, lng = $15,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $16
            RETURNING *;
        `;
        
        // Array de Valores: Ordem e contagem exata (16 parâmetros)
        const values = [
            name,           // $1
            phone,          // $2
            document,       // $3
            address,        // $4
            status,         // $5
            origin,         // $6
            numericOwnerId, // $7 (owner_id)
            email,          // $8
            uc,             // $9
            avgConsumption ? parseFloat(avgConsumption) : null, // $10
            estimatedSavings ? parseFloat(estimatedSavings) : null, // $11
            notes,          // $12
            qsa,            // $13
            lat,            // $14
            lng,            // $15
            id              // $16 (WHERE clause)
        ];

        try {
            const result = await pool.query(query, values);
            return result.rows[0] || null;
        } catch (error) {
            console.error(`Erro CRÍTICO no modelo Lead.update (ID: ${id}):`, error.message);
            throw error;
        }
    }
    
    // 6. Atualiza APENAS o status
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

    // 7. Exclui Lead
    static async delete(id) { 
        return await pool.query('DELETE FROM leads WHERE id = $1 RETURNING *;', [id])
            .then(res => res.rowCount > 0); 
    }
}

module.exports = Lead;