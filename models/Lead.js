// models/Lead.js

const { pool } = require('../config/db');

class Lead {
    // 1. Cria a tabela de Leads se não existir
    static async createTable() {
        // MANTENDO O SEU SCHEMA ORIGINAL COMO BASE DE TRABALHO
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
        
        // Coerção defensiva
        const numericOwnerId = parseInt(ownerId, 10);
        
        const metadata = {
            email: email || null,
            uc: uc || null,
            // Garantindo que valores numéricos sejam null se inválidos, ou float/number
            avgConsumption: avgConsumption ? parseFloat(avgConsumption) : null,
            estimatedSavings: estimatedSavings ? parseFloat(estimatedSavings) : null,
            notes: notes || [],
            qsa: qsa || null,
        };

        const query = `
            INSERT INTO leads (name, phone, document, address, origin, status, owner_id, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *;
        `;
        
        const values = [
            name, phone, document, address, origin, status, 
            numericOwnerId, // $7: Garantido como INT
            JSON.stringify(metadata) // $8
        ];

        try {
            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error('Erro no modelo ao criar lead:', error);
            throw error;
        }
    }
    
    // 3. Busca Lead por ID (Omitido para brevidade - assumido OK)
    static async findById(id) { /* ... */ return await pool.query('SELECT * FROM leads WHERE id = $1', [id]).then(res => res.rows[0] || null); }

    // 4. Busca todos os Leads (Omitido para brevidade - assumido OK)
    static async findAll(ownerId = null, isAdmin = false) { 
        let query = 'SELECT * FROM leads';
        const params = [];

        // CRÍTICO: Usando owner_id aqui para consistência
        if (!isAdmin && ownerId) {
            params.push(ownerId);
            query += ` WHERE owner_id = $${params.length}`; 
        }

        query += ' ORDER BY created_at DESC';
        return await pool.query(query, params).then(res => res.rows);
    }

    // 5. Atualiza Lead Completo - CORREÇÃO DEFINITIVA DO ERRO 500
    static async update(id, { 
        name, phone, document, address, status, origin, ownerId,
        email, uc, avgConsumption, estimatedSavings, notes, qsa 
    }) {
        
        // Coerção defensiva
        const numericOwnerId = parseInt(ownerId, 10);
        
        // 1. Constrói o objeto de metadata JSONB com coerção de números
        const metadata = {
            email: email || null, 
            uc: uc || null,
            avgConsumption: avgConsumption ? parseFloat(avgConsumption) : null, // Garantido como número
            estimatedSavings: estimatedSavings ? parseFloat(estimatedSavings) : null, // Garantido como número
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
        
        // 3. Array de Valores: Ordem e contagem exata (9 parâmetros)
        const values = [
            name,           // $1
            phone,          // $2
            document,       // $3
            address,        // $4
            status,         // $5
            origin,         // $6
            numericOwnerId, // $7: Garantido como INT
            JSON.stringify(metadata), // $8 (JSONB)
            id              // $9 (WHERE clause)
        ];

        try {
            const result = await pool.query(query, values);
            return result.rows[0] || null;
        } catch (error) {
            // Log de erro aprimorado
            console.error(`Erro CRÍTICO no modelo Lead.update (ID: ${id}):`, error.message);
            console.error('Valores Enviados:', values);
            throw error;
        }
    }
    
    // 6. Atualiza APENAS o status (Omitido para brevidade - assumido OK)
    static async updateStatus(id, newStatus) { /* ... */ }

    // 7. Exclui Lead (Omitido para brevidade - assumido OK)
    static async delete(id) { /* ... */ }
}

module.exports = Lead;