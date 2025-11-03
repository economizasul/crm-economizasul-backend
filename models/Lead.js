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

    // 2. Cria um novo Lead (Mantida)
    static async create({ 
        name, phone, document, address, status, origin, ownerId, 
        email, avgConsumption, estimatedSavings, notes, uc, qsa, lat, lng,
        reasonForLoss
    }) {
        const safeOwnerId = ownerId === undefined || ownerId === null || isNaN(parseInt(ownerId)) ? null : parseInt(ownerId);
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
            name, phone, document, address, status, origin, safeOwnerId,
            email, uc, 
            avgConsumption ? parseFloat(avgConsumption) : null,
            estimatedSavings ? parseFloat(estimatedSavings) : null,
            notes, qsa, lat, lng,
            reasonForLoss
        ];
        try {
            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error("Erro no modelo ao criar lead:", error);
            throw error;
        }
    }
    
    // 3. Busca Todos os Leads (Mantida)
    static async findAll({ userId, role, search, status, origin }) {
        const isAdmin = role === 'admin';
        let query = `
            SELECT 
                l.*,
                u.name AS owner_name 
            FROM leads l
            LEFT JOIN users u ON l.owner_id = u.id 
            WHERE 1=1
        `;
        const values = [];
        let valueIndex = 1;
        if (!isAdmin) {
            query += ` AND l.owner_id = $${valueIndex}`;
            values.push(userId);
            valueIndex++;
        }
        if (search) {
            query += ` AND (l.name ILIKE $${valueIndex} OR l.email ILIKE $${valueIndex} OR l.phone ILIKE $${valueIndex})`;
            values.push(`%${search}%`);
            valueIndex++;
        }
        if (status) {
            query += ` AND l.status = $${valueIndex}`;
            values.push(status);
            valueIndex++;
        }
        if (origin) {
            query += ` AND l.origin = $${valueIndex}`;
            values.push(origin);
            valueIndex++;
        }
        query += ` ORDER BY l.updated_at DESC`;
        try {
            const result = await pool.query(query, values);
            return result.rows;
        } catch (error) {
            console.error('Erro ao buscar leads para Kanban (Lead.findAll):', error);
            throw error;
        }
    }
    
    // 4. Busca Lead por ID (Mantida)
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
            console.error('Erro no modelo ao buscar lead por ID:', error);
            throw error;
        }
    }
    
    // 5. Atualiza Lead (Mantida)
    static async update(id, { 
        name, phone, document, address, status, origin, 
        ownerId, 
        email, avgConsumption, estimatedSavings, notes, uc, qsa, lat, lng,
        reasonForLoss, 
        dateWon 
    }) {
        const safeOwnerId = ownerId === undefined || ownerId === null || isNaN(parseInt(ownerId)) ? null : parseInt(ownerId);
        
        let updateFields = [
            `name = $1`, `phone = $2`, `document = $3`, `address = $4`, 
            `status = $5`, `origin = $6`, `owner_id = $7`, `updated_at = CURRENT_TIMESTAMP`, 
            `email = $8`, `uc = $9`, `avg_consumption = $10`, `estimated_savings = $11`, 
            `notes = $12`, `qsa = $13`, `lat = $14`, `lng = $15`, 
            `reason_for_loss = $16`
        ];
        const values = [
            name, phone, document, address, status, origin,
            safeOwnerId,
            email,            
            uc,               
            avgConsumption ? parseFloat(avgConsumption) : null, 
            estimatedSavings ? parseFloat(estimatedSavings) : null, 
            notes,            
            qsa,              
            lat,              
            lng,              
            reasonForLoss     
        ];

        if (status === 'Ganho' && dateWon) {
            updateFields.push(`date_won = COALESCE(date_won, $17)`);
            values.push(dateWon);
        } else if (status !== 'Ganho') {
            updateFields.push(`date_won = NULL`);
        }

        const query = `
            UPDATE leads
            SET ${updateFields.join(', ')}
            WHERE id = $${values.length + 1}
            RETURNING *;
        `;
        values.push(id); 

        try {
            const result = await pool.query(query, values);
            return result.rows[0] || null;
        } catch (error) {
            console.error(`Erro CRÍTICO no modelo Lead.update (ID: ${id}):`, error.message);
            throw error;
        }
    }
    
    // 6. Atualiza APENAS o status (Mantida)
    static async updateStatus(id, newStatus) {
        let updateFields = [`status = $1`, `updated_at = CURRENT_TIMESTAMP`];
        const values = [newStatus];
        if (newStatus === 'Ganho') {
            updateFields.push(`date_won = COALESCE(date_won, CURRENT_TIMESTAMP)`);
        } else if (newStatus !== 'Ganho') {
            updateFields.push(`date_won = NULL`);
        }
        const query = `
            UPDATE leads
            SET ${updateFields.join(', ')}
            WHERE id = $${values.length + 1}
            RETURNING *;
        `;
        values.push(id);
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
    
    // =============================================================
    // FUNÇÕES PARA RELATÓRIOS (Modularizadas para Performance)
    // =============================================================
    
    // [A] Métrica Rápida: Contagens e Valores Simples
    static async getSimpleMetrics(baseCondition, values) {
        const query = `
            SELECT
                COUNT(id) AS total_leads,
                COUNT(CASE WHEN status NOT IN ('Perdido', 'Ganho') THEN 1 END) AS active_leads,
                COUNT(CASE WHEN status = 'Ganho' THEN 1 END) AS total_won_leads,
                COALESCE(SUM(CASE 
                    WHEN status IN ('Em Negociação', 'Proposta Enviada') 
                    THEN estimated_savings 
                    ELSE 0 
                END), 0) AS total_value_in_negotiation
            FROM leads
            WHERE ${baseCondition};
        `;
        try {
            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error("Erro ao obter métricas simples do dashboard:", error);
            throw error;
        }
    }
    
    // [B] Métrica Lenta: Tempo Médio de Resposta/Fechamento (Isolada)
    static async getTimeMetrics(baseCondition, values) {
        const query = `
            SELECT
                COALESCE(
                    AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60) 
                    FILTER (WHERE updated_at > created_at), 
                    0
                ) AS avg_response_time_minutes,
                
                COALESCE(
                    AVG(EXTRACT(EPOCH FROM (date_won - created_at)) / 86400) 
                    FILTER (WHERE status = 'Ganho' AND date_won IS NOT NULL),
                    0
                ) AS avg_time_to_close_days
            FROM leads
            WHERE ${baseCondition};
        `;
        try {
            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error("Erro ao obter métricas de tempo do dashboard:", error);
            throw error;
        }
    }

    // [C] Funil de Vendas
    static async getFunnelData(baseCondition, values) {
        const query = `
            SELECT status, COUNT(*) AS count
            FROM leads
            WHERE ${baseCondition}
            GROUP BY status
            ORDER BY count DESC;
        `;
        try {
            const result = await pool.query(query, values);
            return result.rows;
        } catch (error) {
            console.error("Erro ao obter dados do funil:", error);
            throw error;
        }
    }

    // [D] Performance por Vendedor (Aceita baseCondition com ou sem prefixo 'l.')
    static async getSellerPerformance(baseCondition, values) {
        // CRÍTICO: Usamos LEFT JOIN para garantir que todos os vendedores apareçam, mesmo sem leads.
        // O filtro ${baseCondition} deve usar o prefixo 'l.' (e o controller passará o filtro correto).
        const query = `
            SELECT 
                u.name AS seller_name, 
                COUNT(l.id) AS total_leads, 
                COALESCE(SUM(CASE WHEN l.status = 'Ganho' THEN 1 ELSE 0 END), 0) AS won_leads,
                COALESCE(AVG(EXTRACT(EPOCH FROM (l.date_won - l.created_at)) / 86400) FILTER (WHERE l.status = 'Ganho' AND l.date_won IS NOT NULL), 0) AS avg_time_to_close,
                COALESCE(SUM(CASE WHEN l.status NOT IN ('Ganho', 'Perdido') THEN 1 ELSE 0 END), 0) AS active_leads
            FROM users u
            LEFT JOIN leads l ON l.owner_id = u.id AND ${baseCondition}
            GROUP BY u.name
            ORDER BY won_leads DESC;
        `;
        try {
            const result = await pool.query(query, values);
            return result.rows;
        } catch (error) {
            console.error("Erro ao obter performance por vendedor:", error);
            throw error;
        }
    }
    
    // [E] Razões de Perda
    static async getLossReasons(baseCondition, values) {
        const query = `
            SELECT reason_for_loss, COUNT(*) AS count
            FROM leads 
            WHERE ${baseCondition} AND status = 'Perdido' AND reason_for_loss IS NOT NULL
            GROUP BY reason_for_loss
            ORDER BY count DESC;
        `;
        try {
            const result = await pool.query(query, values);
            return result.rows;
        } catch (error) {
            console.error("Erro ao obter razões de perda:", error);
            throw error;
        }
    }
    
    // [F] Análise de Origem (Nova função modular)
    static async getOriginAnalysis(baseCondition, values) {
        const query = `
            SELECT 
                origin, 
                COUNT(*) AS total_leads, 
                SUM(CASE WHEN status = 'Ganho' THEN 1 ELSE 0 END) AS won_leads
            FROM leads
            WHERE ${baseCondition}
            GROUP BY origin
            ORDER BY total_leads DESC;
        `;
        try {
            const result = await pool.query(query, values);
            return result.rows;
        } catch (error) {
            console.error("Erro ao obter análise de origem:", error);
            throw error;
        }
    }
}

module.exports = Lead;