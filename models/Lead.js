// models/Lead.js

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
    static async create({ 
        name, phone, document, address, origin, status, ownerId, 
        email, uc, avgConsumption, estimatedSavings, notes, qsa 
    }) {
        
        // CRÍTICO: Todos os campos customizados e 'email' vão para metadata
        const metadata = {
            email: email || null,
            uc: uc || null,
            avgConsumption: avgConsumption || null,
            estimatedSavings: estimatedSavings || null,
            notes: notes || [], // Deve ser um array de strings
            qsa: qsa || null,
        };

        // Query INSERT com 8 parâmetros
        const query = `
            INSERT INTO leads (name, phone, document, address, origin, status, owner_id, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *;
        `;
        
        // Array de Valores (8 parâmetros)
        const values = [
            name,           // $1
            phone,          // $2
            document,       // $3
            address,        // $4
            origin,         // $5
            status,         // $6
            ownerId,        // $7
            JSON.stringify(metadata) // $8 (Metadata JSONB)
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
        const query = 'SELECT * FROM leads WHERE id = $1';
        try {
            const result = await pool.query(query, [id]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Erro no modelo ao buscar lead por ID:', error);
            throw error;
        }
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

        try {
            const result = await pool.query(query, params);
            return result.rows;
        } catch (error) {
            console.error('Erro no modelo ao buscar todos os leads:', error);
            throw error;
        }
    }

    // 5. Atualiza Lead Completo - CORREÇÃO DEFINITIVA DO ERRO 500
    static async update(id, { 
        name, phone, document, address, status, origin, ownerId, // 7 Campos principais
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
        
        // 2. Query SQL: 8 colunas sendo SETadas, 9 parâmetros no total.
        // Se este for o ponto de falha, é porque uma das colunas (name, phone, document, address, status, origin, owner_id, metadata)
        // tem um nome diferente no seu DB.
        const query = `
            UPDATE leads
            SET name = $1, phone = $2, document = $3, address = $4, status = $5, origin = $6, owner_id = $7,
                metadata = $8,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $9
            RETURNING *;
        `;
        
        // 3. Array de Valores: Ordem e contagem exata (9 parâmetros)
        const values = [
            name,           // $1
            phone,          // $2
            document,       // $3
            address,        // $4
            status,         // $5
            origin,         // $6
            ownerId,        // $7
            JSON.stringify(metadata), // $8 (JSONB)
            id              // $9 (WHERE clause)
        ];

        try {
            const result = await pool.query(query, values);
            return result.rows[0] || null;
        } catch (error) {
            // Log de erro aprimorado para ajudar na depuração no console do servidor
            console.error(`Erro CRÍTICO no modelo Lead.update (ID: ${id}):`, error.message);
            console.error('Valores Enviados:', values);
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