// services/ReportDataService.js
const { pool } = require('../config/db');

// ==========================================================
// 🛠️ UTILS DE FILTRAGEM
// ==========================================================

/**
 * Constrói a cláusula WHERE e os valores para as queries SQL.
 * @param {Object} filters - Filtros de data, vendedor e origem.
 * @param {number|null} userId - ID do usuário logado (se não for Admin).
 * @param {boolean} isAdmin - Se o usuário é Admin.
 * @returns {Object} { whereClause, values }
 */
const buildFilter = (filters, userId, isAdmin) => {
    // Pega as datas do frontend
    const { startDate, endDate, ownerId, source } = filters;
    
    // Extende as datas para cobrir o dia inteiro
    const formattedStartDate = `${startDate} 00:00:00`;
    const formattedEndDate = `${endDate} 23:59:59`;
    
    // Filtro de data obrigatório (usando a data de criação do lead)
    let whereClause = `WHERE created_at BETWEEN $1 AND $2`;
    const values = [formattedStartDate, formattedEndDate];
    let nextIndex = 3;

    // 1. Filtro por Vendedor (Owner)
    if (!isAdmin) {
        // Usuário normal vê apenas seus leads
        whereClause += ` AND owner_id = $${nextIndex++}`;
        values.push(userId);
    } else if (ownerId && ownerId !== 'all') {
        // Admin ou usuário vê leads de um vendedor específico (se ownerId for passado)
        whereClause += ` AND owner_id = $${nextIndex++}`;
        values.push(ownerId);
    }

    // 2. Filtro por Origem/Fonte
    if (source && source !== 'all') {
        whereClause += ` AND origin = $${nextIndex++}`;
        values.push(source);
    }
    
    return { whereClause, values };
};


class ReportDataService {

    /**
     * 🟢 Função principal para buscar todas as métricas do Dashboard.
     */
    static async getAllDashboardData(filters, userId, isAdmin) {
        
        const { whereClause: baseFilter, values: baseValues } = buildFilter(filters, userId, isAdmin);
        
        try {
            // ----------------------------------------------------
            // 1. MÉTRICAS DE PRODUTIVIDADE E KPIS (em uma única query)
            // ----------------------------------------------------
            const metricsQuery = `
                SELECT
                    -- Leads Ativos (status != Ganho/Perdido)
                    COUNT(*) FILTER (WHERE l.status NOT IN ('Fechado Ganho', 'Fechado Perdido')) AS leads_active,
                    -- Total de Leads Criados no Período
                    COUNT(*) AS total_leads_created,
                    
                    -- Vendas Ganhas
                    COUNT(*) FILTER (WHERE l.status = 'Fechado Ganho') AS total_won_count,
                    COALESCE(SUM(l.avg_consumption) FILTER (WHERE l.status = 'Fechado Ganho'), 0) AS total_won_value_kw,

                    -- Vendas Perdidas
                    COUNT(*) FILTER (WHERE l.status = 'Fechado Perdido') AS total_lost_count,
                    
                    -- Tempo Médio de Fechamento (data_won - created_at) em segundos
                    COALESCE(AVG(EXTRACT(EPOCH FROM (l.date_won - l.created_at))) FILTER (WHERE l.status = 'Fechado Ganho'), 0) AS avg_closing_time_seconds
                FROM leads l
                ${baseFilter};
            `;
            
            const metricsResult = await pool.query(metricsQuery, baseValues);
            const raw = metricsResult.rows[0] || {};
            
            const totalLeadsCreated = parseInt(raw.total_leads_created || 0);
            const totalWonCount = parseInt(raw.total_won_count || 0);
            const totalLostCount = parseInt(raw.total_lost_count || 0);
            
            // Cálculos
            const productivity = {
                leadsActive: parseInt(raw.leads_active || 0),
                totalLeads: totalLeadsCreated,
                totalWonCount: totalWonCount,
                totalWonValueKW: parseFloat(raw.total_won_value_kw || 0),
                totalLostCount: totalLostCount,
                // Taxas (Conversão e Perda) são de 0 a 1.
                conversionRate: totalLeadsCreated > 0 ? (totalWonCount / totalLeadsCreated) : 0, 
                lossRate: totalLeadsCreated > 0 ? (totalLostCount / totalLeadsCreated) : 0,
                // Converte segundos para dias (86400 segundos em 1 dia)
                avgClosingTimeDays: parseFloat(raw.avg_closing_time_seconds || 0) / 86400, 
            };
            
            // ----------------------------------------------------
            // 2. DADOS DO FUNIL DE VENDAS (Agrupado por Status Atual)
            // ----------------------------------------------------
            const funnelQuery = `
                SELECT 
                    status AS stageName,
                    COUNT(*) AS count
                FROM leads
                ${baseFilter}
                GROUP BY status
                ORDER BY count DESC;
            `;
            const funnelResult = await pool.query(funnelQuery, baseValues);
            const funnel = funnelResult.rows.map(row => ({
                stageName: row.stagename,
                count: parseInt(row.count)
            }));


            // ----------------------------------------------------
            // 3. ANÁLISE DE MOTIVOS DE PERDA (Lost Reasons)
            // ----------------------------------------------------
            const lostReasonsQuery = `
                SELECT 
                    reason_for_loss AS reason,
                    COUNT(*) AS count
                FROM leads
                ${baseFilter}
                AND status = 'Fechado Perdido'
                AND reason_for_loss IS NOT NULL AND reason_for_loss != ''
                GROUP BY reason_for_loss
                ORDER BY count DESC;
            `;
            const lostReasonsResult = await pool.query(lostReasonsQuery, baseValues);
            
            const lostReasonsData = {
                reasons: lostReasonsResult.rows.map(row => ({
                    reason: row.reason,
                    count: parseInt(row.count)
                })),
                totalLost: totalLostCount // Reutiliza a contagem geral
            };
            
            return {
                productivity,
                funnel,
                lostReasons: lostReasonsData,
                // dailyActivity: [], 
            };

        } catch (error) {
            console.error('Erro ao buscar todos os dados do dashboard:', error);
            throw error;
        }
    }
    
    /**
     * Método auxiliar para buscar leads brutos para a exportação CSV/PDF.
     */
    static async getLeadsForExport(filters, userId, isAdmin) {
        const { whereClause, values } = buildFilter(filters, userId, isAdmin);
        
        const exportQuery = `
            SELECT 
                l.*,
                u.name AS owner_name
            FROM leads l
            LEFT JOIN users u ON u.id = l.owner_id
            ${whereClause}
            ORDER BY l.created_at DESC;
        `;
        
        try {
            const result = await pool.query(exportQuery, values);
            return result.rows;
        } catch (error) {
            console.error('Erro ao buscar leads para exportação:', error);
            throw error;
        }
    }
}

module.exports = ReportDataService;