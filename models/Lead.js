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
    static async create({ name, phone, document, address, origin, status, ownerId, email, uc, avgConsumption, estimatedSavings, notes, qsa }) {
        const metadata = {
            email: email || null, 
            uc: uc || null,
            avgConsumption: avgConsumption || null,
            estimatedSavings: estimatedSavings || null,
            notes: notes || [],
            qsa: qsa || null,
        };

        const query = `
            INSERT INTO leads (name, phone, document, address, origin, status, owner_id, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *;
        `;
        
        // 8 valores: name, phone, document, address, origin, status, ownerId, metadata (JSON)
        const values = [name, phone, document, address, origin, status, ownerId, JSON.stringify(metadata)];

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
        const query = 'SELECT * FROM leads WHERE id = $1';
        try {
            const result = await pool.query(query, [id]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Erro no modelo ao buscar lead por ID:', error);
            throw error;
        }
    }

    // 4. Busca todos os Leads (com filtros básicos)
    static async findAll(ownerId = null, isAdmin = false) {
        let query = 'SELECT * FROM leads';
        const params = [];

        if (!isAdmin && ownerId) {
            params.push(ownerId);
            query += ` WHERE owner_id = $${params.length}`;
        }

        query += ' ORDER BY created_at DESC';

        try {
            const result = await pool.query(query, params);
            return result.rows;
        } catch (error) {
            console.error('Erro no modelo ao buscar todos os leads:', error);
            throw error;
        }
    }

    // 5. Atualiza Lead Completo (incluindo campos de metadata) - REVISÃO FINAL
    static async update(id, { 
        name, phone, document, address, status, origin, ownerId, // Campos principais
        email, uc, avgConsumption, estimatedSavings, notes, qsa // Campos de metadata
    }) {
        
        // 1. Constrói o objeto de metadata JSONB com todos os campos customizados
        const metadata = {
            email: email || null, 
            uc: uc || null,
            avgConsumption: avgConsumption || null,
            estimatedSavings: estimatedSavings || null,
            notes: notes || [], 
            qsa: qsa || null,
        };
        
        // 2. Query SQL: 8 colunas sendo SETadas, 9 parâmetros no total
        const query = `
            UPDATE leads
            SET name = $1, phone = $2, document = $3, address = $4, status = $5, origin = $6, owner_id = $7,
                metadata = $8,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $9
            RETURNING *;
        `;
        
        // 3. Array de Valores: Ordem precisa bater perfeitamente com a query
        const values = [
            name,           // $1
            phone,          // $2
            document,       // $3. Se for null/undefined, passa null (se a coluna permitir)
            address,        // $4. Se for null/undefined, passa null (se a coluna permitir)
            status,         // $5
            origin,         // $6
            ownerId,        // $7
            JSON.stringify(metadata), // $8 (JSONB)
            id              // $9 (WHERE clause)
        ];

        try {
            // Se o erro 500 está aqui, significa que a DB não gostou da Query ou dos Valores.
            const result = await pool.query(query, values);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Erro CRÍTICO no modelo ao atualizar lead (Verifique Schema):', error.message);
            throw error;
        }
    }
    
    // 6. Atualiza APENAS o status (Para Drag and Drop)
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