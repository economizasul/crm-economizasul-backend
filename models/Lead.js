// models/Lead.js

const { pool } = require('../config/db');

class Lead {
    // 1. Cria a tabela de Leads se não existir
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
                -- NOVO CAMPO para o Relatório de Perda
                reason_for_loss VARCHAR(255), 
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                date_won TIMESTAMP WITHOUT TIME ZONE -- NOVO CAMPO para métrica de tempo de fechamento
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

    // 2. Cria um novo Lead (APLICADA CORREÇÃO DE ownerId)
    static async create({ 
        name, phone, document, address, status, origin, ownerId, 
        email, avgConsumption, estimatedSavings, notes, uc, qsa, lat, lng,
        reasonForLoss
    }) {
        // 💡 CORREÇÃO: Garante que ownerId seja NULL se não for um INT válido (para criação).
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
            name, phone, document, address, status, origin, safeOwnerId, // USANDO safeOwnerId
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
            console.log('SQL Executado (Lead.findAll):', query, values); 
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
    
    // 5. Atualiza Lead (CORREÇÃO CRÍTICA APLICADA)
    static async update(id, { 
        name, phone, document, address, status, origin, 
        ownerId, // <--- ONDE O ERRO OCORRIA
        email, avgConsumption, estimatedSavings, notes, uc, qsa, lat, lng,
        reasonForLoss, 
        dateWon 
    }) {
        // 💡 CORREÇÃO CRÍTICA: Garante que ownerId é um INT ou NULL.
        // Isso resolve o erro "invalid input syntax for type integer: "undefined""
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
            safeOwnerId, // USANDO O VALOR SEGURO AQUI!          
            email,            
            uc,               
            avgConsumption ? parseFloat(avgConsumption) : null, 
            estimatedSavings ? parseFloat(estimatedSavings) : null, 
            notes,            
            qsa,              
            lat,              
            lng,              
            reasonForLoss     // $16
        ];

        // Adiciona date_won se o status for 'Ganho'
        if (status === 'Ganho' && dateWon) {
            // Usa COALESCE para preencher apenas na primeira vez, mantendo a data original de ganho
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

        // Lógica de date_won
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
    // NOVAS FUNÇÕES PARA RELATÓRIOS (Mantidas)
    // =============================================================
    
    // 8. Busca dados para o Dashboard de Métricas
    static async getDashboardMetrics(ownerId, isAdmin, startDate, endDate) {
        let baseCondition = `1=1`;
        const values = [];
        let valueIndex = 1;

        if (startDate && endDate) {
            baseCondition += ` AND l.created_at BETWEEN $${valueIndex} AND $${valueIndex + 1}`;
            values.push(startDate, endDate);
            valueIndex += 2;
        }

        if (ownerId || !isAdmin) {
             const filterId = ownerId || (isAdmin ? null : ownerId);
             if (filterId) {
                baseCondition += ` AND l.owner_id = $${valueIndex}`;
                values.push(filterId);
                valueIndex++;
             }
        }
        
        const query = `
            SELECT
                -- 1. Novos Leads no Período
                COUNT(l.id) AS total_leads,
                
                -- 2. Leads Ativos (Não Perdidos e Não Ganhos)
                COUNT(CASE WHEN l.status NOT IN ('Perdido', 'Ganho') THEN 1 END) AS active_leads,
                
                -- 3. Total de Leads Ganhos (para Taxa de Conversão)
                COUNT(CASE WHEN l.status = 'Ganho' THEN 1 END) AS total_won_leads,
                
                -- 4. Valor Total em Negociação
                COALESCE(SUM(CASE 
                    WHEN l.status IN ('Em Negociação', 'Proposta Enviada') 
                    THEN l.estimated_savings 
                    ELSE 0 
                END), 0) AS total_value_in_negotiation,
                
                -- 5. Tempo Médio de Resposta (Apenas se updated_at > created_at)
                AVG(CASE WHEN l.updated_at > l.created_at THEN EXTRACT(EPOCH FROM (l.updated_at - l.created_at)) / 60 ELSE NULL END) AS avg_response_time_minutes
                
            FROM leads l
            WHERE ${baseCondition};
        `;
        
        try {
            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error("Erro ao obter métricas do dashboard:", error);
            throw error;
        }
    }
    
    // 9. Funil de Vendas e Performance de Vendedores (Mantida)
    static async getFunnelAndPerformance(filters) {
        const query = `
            WITH LeadStatus AS (
                SELECT 
                    l.status, 
                    l.owner_id, 
                    l.origin,
                    l.estimated_savings AS value,
                    EXTRACT(EPOCH FROM (l.date_won - l.created_at)) / 86400 AS time_to_close_days,
                    l.reason_for_loss,
                    CASE WHEN l.status = 'Ganho' THEN 1 ELSE 0 END AS is_won
                FROM leads l
                -- Filtros do ReportController devem ser injetados aqui
            )
            
            -- Dados do Funil
            SELECT 'Funnel' AS type, status, COUNT(*) AS count
            FROM LeadStatus
            GROUP BY status
            
            UNION ALL
            
            -- Performance por Vendedor 
            SELECT 
                'Performance' AS type, 
                u.name AS seller_name, 
                COUNT(ls.*) AS total_leads, 
                COALESCE(SUM(is_won), 0) AS won_leads,
                AVG(CASE WHEN is_won = 1 THEN time_to_close_days END) AS avg_time_to_close,
                COALESCE(SUM(CASE WHEN status NOT IN ('Ganho', 'Perdido') THEN 1 ELSE 0 END), 0) AS active_leads
            FROM users u
            LEFT JOIN LeadStatus ls ON ls.owner_id = u.id
            GROUP BY u.name
            
            UNION ALL
            
            -- Análise de Origem 
            SELECT 'Origin' AS type, origin, COUNT(*) AS total_leads, SUM(is_won) AS won_leads
            FROM LeadStatus
            GROUP BY origin
            
            UNION ALL
            
            -- Razões de Perda
            SELECT 'LossReason' AS type, reason_for_loss, COUNT(*) AS count
            FROM LeadStatus 
            WHERE status = 'Perdido' AND reason_for_loss IS NOT NULL
            GROUP BY reason_for_loss;
        `;
        
        try {
            const result = await pool.query(query, []); // Os valores dos filtros devem ser passados aqui
            return result.rows;
        } catch (error) {
            console.error("Erro ao obter funil e performance:", error);
            throw error;
        }
    }
}

module.exports = Lead;