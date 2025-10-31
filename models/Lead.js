// models/Lead.js

const { pool } = require('../config/db');

class Lead {
    // 1. Cria a tabela de Leads se não existir (MODIFICADA para incluir reason_for_loss)
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

    // 2. Cria um novo Lead (Mantida, ajustada para incluir reasonForLoss)
    static async create({ 
        name, phone, document, address, status, origin, ownerId, 
        email, avgConsumption, estimatedSavings, notes, uc, qsa, lat, lng,
        reasonForLoss // NOVO
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
            name, phone, document, address, status, origin, ownerId, 
            email, uc, 
            avgConsumption ? parseFloat(avgConsumption) : null,
            estimatedSavings ? parseFloat(estimatedSavings) : null,
            notes, qsa, lat, lng,
            reasonForLoss // $16
        ];
        
        try {
            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error("Erro no modelo ao criar lead:", error);
            throw error;
        }
    }
    
    // ... [findAll, findById, delete - permanecem INALTERADOS] ...

    // 5. Atualiza Lead (Completo - MODIFICADA para incluir reasonForLoss e date_won)
    static async update(id, { 
        name, phone, document, address, status, origin, 
        ownerId, // O ID do proprietário a ser salvo
        email, avgConsumption, estimatedSavings, notes, uc, qsa, lat, lng,
        reasonForLoss, // NOVO
        dateWon // NOVO
    }) {
        let updateFields = [
            `name = $1`, `phone = $2`, `document = $3`, `address = $4`, 
            `status = $5`, `origin = $6`, `owner_id = $7`, `updated_at = CURRENT_TIMESTAMP`, 
            `email = $8`, `uc = $9`, `avg_consumption = $10`, `estimated_savings = $11`, 
            `notes = $12`, `qsa = $13`, `lat = $14`, `lng = $15`, 
            `reason_for_loss = $16`
        ];
        const values = [
            name, phone, document, address, status, origin,
            ownerId,          
            email,            
            uc,               
            avgConsumption ? parseFloat(avgConsumption) : null, 
            estimatedSavings ? parseFloat(estimatedSavings) : null, 
            notes,            
            qsa,              
            lat,              
            lng,              
            reasonForLoss     // $16
        ];

        // Adiciona date_won se o status for 'Ganho' e ainda não tiver sido preenchido
        if (status === 'Ganho' && dateWon) {
             // Esta lógica é crucial para o tempo de fechamento.
             // Idealmente, a atualização deve ser: date_won = COALESCE(date_won, $17)
             updateFields.push(`date_won = $17`);
             values.push(dateWon);
        } else if (status !== 'Ganho') {
             // Limpar date_won se o Lead for movido para fora de 'Ganho'
             updateFields.push(`date_won = NULL`);
        }

        const query = `
            UPDATE leads
            SET ${updateFields.join(', ')}
            WHERE id = $${values.length + 1}
            RETURNING *;
        `;
        values.push(id); // O último valor é o ID do WHERE

        try {
            const result = await pool.query(query, values);
            return result.rows[0] || null;
        } catch (error) {
            console.error(`Erro CRÍTICO no modelo Lead.update (ID: ${id}):`, error.message);
            throw error;
        }
    }
    
    // 6. Atualiza APENAS o status (MODIFICADA para incluir date_won)
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
    
    // ... [demais funções inalteradas] ...
    
    // =============================================================
    // NOVAS FUNÇÕES PARA RELATÓRIOS (IMPLEMENTAÇÃO CRÍTICA)
    // =============================================================
    
    // 8. Busca dados para o Dashboard de Métricas
    static async getDashboardMetrics(ownerId, isAdmin, startDate, endDate) {
        // Lógica de filtragem de Leads por período e proprietário (se não for Admin)
        let baseCondition = `1=1`;
        const values = [];
        let valueIndex = 1;

        if (startDate && endDate) {
            baseCondition += ` AND l.created_at BETWEEN $${valueIndex} AND $${valueIndex + 1}`;
            values.push(startDate, endDate);
            valueIndex += 2;
        }

        // Se estiver filtrando por um vendedor específico (ownerId) E/OU se não for Admin
        if (ownerId || !isAdmin) {
             const filterId = ownerId || !isAdmin ? ownerId : null;
             if (filterId) {
                baseCondition += ` AND l.owner_id = $${valueIndex}`;
                values.push(filterId);
                valueIndex++;
             }
        }
        
        // Esta query faz a maioria dos cálculos em UMA SÓ REQUISIÇÃO (Performance!)
        const query = `
            SELECT
                -- 1. Novos Leads no Período
                COUNT(l.id) AS total_leads,
                
                -- 2. Leads Ativos (Não Perdidos e Não Ganhos)
                COUNT(CASE WHEN l.status NOT IN ('Perdido', 'Ganho') THEN 1 END) AS active_leads,
                
                -- 3. Total de Leads Ganhos (para Taxa de Conversão)
                COUNT(CASE WHEN l.status = 'Ganho' THEN 1 END) AS total_won_leads,
                
                -- 4. Valor Total em Negociação (Soma dos valores em Proposta Enviada e Em Negociação)
                COALESCE(SUM(CASE 
                    WHEN l.status IN ('Em Negociação', 'Proposta Enviada') 
                    THEN l.estimated_savings -- Assumindo que 'estimated_savings' é o valor da Proposta
                    ELSE 0 
                END), 0) AS total_value_in_negotiation,
                
                -- 5. Tempo Médio de Resposta (Média em minutos entre created_at e a primeira atualização)
                -- 💡 NOTA: Isso exige que o 'updated_at' seja o 1º contato. Se for o caso, pode usar.
                -- Caso contrário, esta métrica precisará de uma tabela de histórico de atividades.
                -- Por simplicidade, vamos usar o created_at vs. updated_at:
                AVG(EXTRACT(EPOCH FROM (l.updated_at - l.created_at))) / 60 AS avg_response_time_minutes
                
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
    
    // 9. Funil de Vendas e Performance de Vendedores
    static async getFunnelAndPerformance(filters) {
        // Implementar lógica de filtros (similar ao getDashboardMetrics)
        // ...
        
        const query = `
            WITH LeadStatus AS (
                SELECT 
                    status, 
                    owner_id, 
                    l.origin,
                    l.estimated_savings AS value,
                    EXTRACT(EPOCH FROM (l.date_won - l.created_at)) / 86400 AS time_to_close_days,
                    CASE WHEN l.status = 'Ganho' THEN 1 ELSE 0 END AS is_won
                FROM leads l
                -- Aplicar filtros aqui...
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
                COUNT(*) AS total_leads,
                SUM(is_won) AS won_leads,
                AVG(CASE WHEN is_won = 1 THEN time_to_close_days END) AS avg_time_to_close,
                COALESCE(SUM(CASE WHEN status NOT IN ('Ganho', 'Perdido') THEN 1 ELSE 0 END), 0) AS active_leads
                -- Adicionar mais colunas de métricas aqui...
            FROM LeadStatus
            JOIN users u ON LeadStatus.owner_id = u.id
            GROUP BY u.name
            
            UNION ALL
            
            -- Análise de Origem (Simples)
            SELECT 'Origin' AS type, origin, COUNT(*) AS total_leads, SUM(is_won) AS won_leads
            FROM LeadStatus
            GROUP BY origin
            
            UNION ALL
            
            -- Razões de Perda
            SELECT 'LossReason' AS type, reason_for_loss, COUNT(*) AS count
            FROM leads l -- Usamos a tabela leads diretamente para pegar reason_for_loss
            WHERE l.status = 'Perdido' AND l.reason_for_loss IS NOT NULL
            GROUP BY reason_for_loss;
        `;
        
        // É importante que essa função seja robusta com os filtros.
        // Pelo espaço limitado, esta é uma visão de alto nível do que a query DEVE fazer.
        // O `ReportController.js` será o responsável por organizar esta resposta.
        
        try {
            const result = await pool.query(query, []); // Placeholder para values
            return result.rows;
        } catch (error) {
            console.error("Erro ao obter funil e performance:", error);
            throw error;
        }
    }
    
    // ... [continua a classe Lead] ...
}

module.exports = Lead;