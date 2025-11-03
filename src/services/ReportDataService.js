// src/services/ReportDataService.js

const { pool } = require('../config/db');
// Assumindo que você tem um utilitário para formatar datas e construir WHERE clauses
const SqlUtils = require('../utils/SqlUtils'); 

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
    
    // ... (Outros métodos auxiliares como _getAllLeads) ...

    // =============================================================
    // 2. BUSCA PRINCIPAL (Métricas para o Dashboard)
    // =============================================================
    
    /**
     * Busca todas as métricas necessárias para popular o dashboard de relatórios.
     */
    async getDashboardMetrics(filters, userId, isAdmin) {
        try {
            const { whereClause, values } = this._buildBaseConditions(filters, userId, isAdmin);
            
            // ⚠️ AQUI ESTÁ A CHAVE: Rodar uma única consulta complexa para todas as métricas

            const query = `
                WITH BaseLeads AS (
                    -- Seleciona todos os leads ativos com os filtros aplicados
                    SELECT 
                        l.id, l.stage, l.value, l.created_at, l.updated_at,
                        -- Adiciona um campo de 'dias de fechamento' para cálculo da média
                        CASE 
                            WHEN l.stage = 'Fechado Ganho' THEN EXTRACT(DAY FROM (l.updated_at - l.created_at))
                            ELSE NULL 
                        END AS closing_days
                    FROM leads l
                    ${whereClause}
                ),
                WonLeads AS (
                    -- Leads Fechados Ganhos (para valor e quantidade)
                    SELECT
                        COUNT(id) AS total_won_count,
                        COALESCE(SUM(value), 0) AS total_won_value,
                        COALESCE(AVG(closing_days), 0) AS avg_closing_time_days
                    FROM BaseLeads
                    WHERE stage = 'Fechado Ganho'
                ),
                LostLeads AS (
                    -- Leads Fechados Perdidos (para taxa de perda e motivos)
                    SELECT
                        COUNT(id) AS total_lost_count
                    FROM BaseLeads
                    WHERE stage = 'Fechado Perdido'
                ),
                ActiveLeads AS (
                    -- Leads Ativos (para total e ponderação de forecast)
                    SELECT
                        COUNT(id) AS leads_active,
                        COALESCE(SUM(value * (
                            CASE stage
                                WHEN 'Qualificação' THEN 0.25
                                WHEN 'Proposta' THEN 0.50
                                WHEN 'Negociação' THEN 0.75
                                ELSE 0.05 -- Peso baixo para 'Primeiro Contato'
                            END
                        )), 0) AS weighted_value,
                        COALESCE(SUM(value), 0) AS total_pipeline_value
                    FROM BaseLeads
                    WHERE stage NOT IN ('Fechado Ganho', 'Fechado Perdido')
                )
                
                -- Combina todos os resultados em uma única linha
                SELECT
                    (SELECT leads_active FROM ActiveLeads) AS leads_active,
                    (SELECT total_won_count FROM WonLeads) AS total_won_count,
                    (SELECT total_won_value FROM WonLeads) AS total_won_value,
                    (SELECT avg_closing_time_days FROM WonLeads) AS avg_closing_time_days,
                    (SELECT total_lost_count FROM LostLeads) AS total_lost_count,
                    (SELECT weighted_value FROM ActiveLeads) AS weighted_value,
                    (SELECT total_pipeline_value FROM ActiveLeads) AS total_pipeline_value,
                    -- Total geral para cálculo de taxa de conversão
                    (SELECT COUNT(id) FROM BaseLeads) AS total_leads_base
            `;

            const result = await pool.query(query, values);
            const rawMetrics = result.rows[0];
            
            // Cálculo de Taxas
            const totalLeadsConsidered = rawMetrics.total_leads_base; // Total de leads na base de filtros
            
            // Prepara o objeto final formatado
            return {
                productivity: {
                    leadsActive: rawMetrics.leads_active,
                    totalWonCount: rawMetrics.total_won_count,
                    totalWonValue: rawMetrics.total_won_value,
                    avgClosingTimeDays: rawMetrics.avg_closing_time_days,
                    lossRate: totalLeadsConsidered > 0 ? rawMetrics.total_lost_count / totalLeadsConsidered : 0,
                    conversionRate: totalLeadsConsidered > 0 ? rawMetrics.total_won_count / totalLeadsConsidered : 0,
                },
                salesForecast: {
                    weightedValue: rawMetrics.weighted_value,
                    totalValue: rawMetrics.total_pipeline_value,
                },
                // ... (Faltam funil e motivos de perda, veja os passos 3 e 4)
                funnelStages: [], 
                lostLeadsAnalysis: { reasons: [], totalLost: rawMetrics.total_lost_count },
            };

        } catch (error) {
            console.error("Erro ao buscar métricas do dashboard no DB:", error);
            throw new Error('Falha na busca de métricas do banco de dados.');
        }
    }
    
    // =============================================================
    // 3. BUSCA DOS MOTIVOS DE PERDA (LOST REASONS)
    // =============================================================

    async getLostReasonsAnalysis(filters, userId, isAdmin) {
         // Reutiliza a função _buildBaseConditions, mas foca em leads perdidos
         const { whereClause, values } = this._buildBaseConditions(filters, userId, isAdmin);
         
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
             totalLost: result.rows.reduce((sum, r) => sum + parseInt(r.count, 10), 0)
         };
    }

    // =============================================================
    // 4. BUSCA DAS ETAPAS DO FUNIL (FUNNEL STAGES)
    // =============================================================

    async getFunnelStages(filters, userId, isAdmin) {
         const { whereClause, values } = this._buildBaseConditions(filters, userId, isAdmin);
         
         const query = `
             SELECT 
                 l.stage AS stage_name,
                 COUNT(l.id) AS count
             FROM leads l
             ${whereClause}
             GROUP BY 1
             -- Ordena por uma ordem lógica do funil
             ORDER BY 
                 CASE l.stage
                     WHEN 'Primeiro Contato' THEN 1
                     WHEN 'Qualificação' THEN 2
                     WHEN 'Proposta' THEN 3
                     WHEN 'Negociação' THEN 4
                     WHEN 'Fechado Ganho' THEN 5
                     WHEN 'Fechado Perdido' THEN 6
                     ELSE 7
                 END;
         `;

         const result = await pool.query(query, values);
         return result.rows.map(row => ({
             stageName: row.stage_name,
             count: parseInt(row.count, 10)
         }));
    }
    
    // =============================================================
    // 5. BUSCA DO RELATÓRIO ANALÍTICO (ANALYTIC NOTES)
    // =============================================================

    async getAnalyticNotes(leadId) {
        // ... (Implementação para buscar lead, anotações e vendedor, conforme planejado)
        // Esta é a consulta mais complexa de ser otimizada em um único passo, 
        // mas aqui está a base:
        
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