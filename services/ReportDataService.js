// services/ReportDataService.js

const { pool } = require('../db'); // CORRIGIDO: '../../config/db' -> '../db' (ajustado para estrutura na raiz)

class ReportDataService {
    
    // =============================================================
    // 1. MÉTODOS AUXILIARES (DE PERMISSÃO E FILTROS)
    // =============================================================
    
    /**
     * Constrói a cláusula WHERE baseando-se nos filtros e permissões do usuário.
     * @param {Object} filters - Filtros de data, vendedor, origem, etc.
     * @param {number} userId - ID do usuário autenticado.
     * @param {boolean} isAdmin - Flag de permissão para ver todos os dados.
     * @returns {{whereClause: string, values: Array}} Objeto com a cláusula WHERE e os valores.
     */
    _buildBaseConditions(filters, userId, isAdmin) {
        // Inicializa a cláusula WHERE com a condição básica (Leads ativos ou relevantes)
        let whereClause = `
            WHERE l.is_active = TRUE
            AND l.created_at IS NOT NULL -- Apenas leads com data de criação
        `;
        let values = [];
        let valueIndex = 1;

        // 1. Filtragem por Permissão (Apenas Leads do próprio usuário, se não for admin)
        if (!isAdmin) {
            whereClause += ` AND l.owner_id = $${valueIndex}`;
            values.push(userId);
            valueIndex++;
        }

        // 2. Filtragem por Período (DATA)
        if (filters.startDate) {
            whereClause += ` AND l.created_at >= $${valueIndex}`;
            values.push(filters.startDate);
            valueIndex++;
        }
        if (filters.endDate) {
            // Adiciona um dia para incluir o dia final inteiro
            const endDatePlusOne = new Date(filters.endDate);
            endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
            whereClause += ` AND l.created_at < $${valueIndex}`; 
            values.push(endDatePlusOne.toISOString().split('T')[0]);
            valueIndex++;
        }

        // 3. Filtragem por Vendedor (se o admin/gerente selecionou um vendedor)
        if (filters.vendorId && filters.vendorId !== 'all') {
             // Se não for o próprio userId (pois já foi tratado no isAdmin)
             if (isAdmin || filters.vendorId !== userId) { 
                whereClause += ` AND l.owner_id = $${valueIndex}`;
                values.push(filters.vendorId);
                valueIndex++;
             }
        }
        
        // 4. Filtragem por Origem (Source)
        if (filters.source && filters.source !== 'all') {
            whereClause += ` AND l.source = $${valueIndex}`;
            values.push(filters.source);
            valueIndex++;
        }
        
        return { whereClause, values };
    }

    // =============================================================
    // 3. BUSCA DOS MOTIVOS DE PERDA (LOST REASONS)
    // =============================================================

    async getLostReasonsAnalysis(filters, userId, isAdmin) {
        // Reutiliza a função _buildBaseConditions, mas foca em leads perdidos
        const { whereClause, values } = this._buildBaseConditions(filters, userId, isAdmin);
        
        // A QUERY É IDÊNTICA, MAS A CLÁUSULA WHERE É AJUSTADA PARA O CONTEXTO
        // USAMOS L.CREATED_AT PARA FILTRAR
        const query = `
            SELECT 
                l.lost_reason AS reason,
                COUNT(l.id) AS count
            FROM leads l
            ${whereClause}
            AND l.stage = 'Fechado Perdido'
            GROUP BY 1
            ORDER BY count DESC;
        `;

        const result = await pool.query(query, values);
        return {
            reasons: result.rows,
        };
    }

    // =============================================================
    // 4. BUSCA DAS MÉTRICAS DO DASHBOARD (PRINCIPAL)
    // =============================================================

    async getDashboardMetrics(filters, userId, isAdmin) {
        try {
            // A. Constrói a condição base para todas as consultas
            const { whereClause, values } = this._buildBaseConditions(filters, userId, isAdmin);

            // B. Consulta principal (Métricas Aggregadas)
            const mainQuery = `
                WITH BaseLeads AS (
                    SELECT COUNT(*) AS total_leads_base
                    FROM leads l
                    ${whereClause}
                ),
                ActiveLeads AS (
                    SELECT 
                        COUNT(*) AS leads_active,
                        COALESCE(SUM(estimated_savings), 0) AS total_pipeline_value,
                        COALESCE(
                            SUM(CASE 
                                WHEN l.status = 'Novo' THEN estimated_savings * 0.1
                                WHEN l.status = 'Contato Inicial' THEN estimated_savings * 0.3
                                WHEN l.status = 'Qualificado' THEN estimated_savings * 0.5
                                WHEN l.status = 'Proposta Enviada' THEN estimated_savings * 0.7
                                WHEN l.status = 'Em Negociação' THEN estimated_savings * 0.9
                                ELSE 0
                            END),
                            0
                        ) AS weighted_value
                    FROM leads l
                    ${whereClause}
                    AND l.status NOT IN ('Ganho', 'Perdido')
                ),
                WonLeads AS (
                    SELECT 
                        COUNT(*) AS total_won_count,
                        COALESCE(SUM(estimated_savings), 0) AS total_won_value,
                        COALESCE(
                            AVG(EXTRACT(DAY FROM (date_won - created_at))) FILTER (WHERE date_won IS NOT NULL),
                            0
                        ) AS avg_closing_time_days
                    FROM leads l
                    ${whereClause}
                    AND l.status = 'Ganho'
                ),
                LostLeads AS (
                    COUNT(*) AS total_lost_count
                    FROM leads l
                    ${whereClause}
                    AND l.status = 'Perdido'
                )
                SELECT 
                    (SELECT total_leads_base FROM BaseLeads) AS total_leads_base,
                    (SELECT leads_active FROM ActiveLeads) AS leads_active,
                    (SELECT total_won_count FROM WonLeads) AS total_won_count,
                    (SELECT total_won_value FROM WonLeads) AS total_won_value,
                    (SELECT avg_closing_time_days FROM WonLeads) AS avg_closing_time_days,
                    (SELECT total_lost_count FROM LostLeads) AS total_lost_count,
                    (SELECT weighted_value FROM ActiveLeads) AS weighted_value,
                    (SELECT total_pipeline_value FROM ActiveLeads) AS total_pipeline_value;
            `;

            const result = await pool.query(mainQuery, values);
            const rawMetrics = result.rows[0];
            
            const totalLeadsConsidered = rawMetrics.total_leads_base; 

            // B. Chama os métodos auxiliares
            const lostLeadsAnalysis = await this.getLostReasonsAnalysis(filters, userId, isAdmin);
            const funnelStages = await this.getFunnelStages(filters, userId, isAdmin);

            // C. Prepara o objeto final formatado
            return {
                productivity: {
                    leadsActive: rawMetrics.leads_active,
                    totalWonCount: parseInt(rawMetrics.total_won_count),
                    totalWonValue: rawMetrics.total_won_value,
                    avgClosingTimeDays: rawMetrics.avg_closing_time_days,
                    lossRate: totalLeadsConsidered > 0 ? rawMetrics.total_lost_count / totalLeadsConsidered : 0,
                    conversionRate: totalLeadsConsidered > 0 ? rawMetrics.total_won_count / totalLeadsConsidered : 0,
                },
                salesForecast: {
                    weightedValue: rawMetrics.weighted_value,
                    totalValue: rawMetrics.total_pipeline_value,
                },
                funnelStages: funnelStages, 
                lostLeadsAnalysis: lostLeadsAnalysis,
            };

        } catch (error) {
            console.error("Erro ao buscar métricas do dashboard no DB:", error);
            throw new Error('Falha na busca de métricas do banco de dados.');
        }
    }
    
    // =============================================================
    // 5. BUSCA DO RELATÓRIO ANALÍTICO (ANALYTIC NOTES)
    // =============================================================

    async getAnalyticNotes(leadId) {
        // ... (Implementação para buscar lead, anotações e vendedor, mantida do código anterior)
        const leadInfoQuery = `
            SELECT 
                l.id, l.name, l.stage, l.value, l.source, l.owner_id AS "ownerId",
                u.name AS "ownerName"
            FROM leads l
            JOIN users u ON u.id = l.owner_id
            WHERE l.id = $1
        `;

        const notesQuery = `
            SELECT 
                n.id, n.content, n.type, n.created_at AS "createdAt",
                u.name AS "vendorName"
            FROM lead_notes n
            JOIN users u ON u.id = n.user_id
            WHERE n.lead_id = $1
            ORDER BY n.created_at DESC;
        `;

        try {
            const leadResult = await pool.query(leadInfoQuery, [leadId]);
            if (leadResult.rows.length === 0) return null;

            const notesResult = await pool.query(notesQuery, [leadId]);

            return {
                leadInfo: leadResult.rows[0],
                notes: notesResult.rows
            };
        } catch (error) {
            console.error("Erro ao buscar dados analíticos:", error);
            throw new Error('Falha na busca de dados analíticos do banco de dados.');
        }
    }
}

module.exports = new ReportDataService();