// services/ReportDataService.js
const { pool } = require('../config/db');
const { format } = require('date-fns');

// ==========================================================
// 🛠️ UTILS DE FILTRAGEM
// ==========================================================

const buildFilter = (filters, userId, isAdmin) => {
    const { startDate, endDate, ownerId, source } = filters;
    
    // Define data padrão se faltar
    const defaultDateString = format(new Date(), 'yyyy-MM-dd');

    // Garante que as datas de filtro estejam no formato YYYY-MM-DD e adiciona a hora
    const start = startDate && startDate.trim() ? startDate : defaultDateString;
    const end = endDate && endDate.trim() ? endDate : defaultDateString;

    const formattedStartDate = `${start} 00:00:00`;
    const formattedEndDate = `${end} 23:59:59`;
    
    let whereClause = `WHERE created_at BETWEEN $1 AND $2`;
    const values = [formattedStartDate, formattedEndDate];
    let nextIndex = 3;

    // 1. Filtro por Vendedor (Owner)
    if (!isAdmin) {
        whereClause += ` AND owner_id = $${nextIndex++}`;
        values.push(userId); 
    } else if (ownerId && ownerId !== 'all') {
        whereClause += ` AND owner_id = $${nextIndex++}`;
        values.push(ownerId);
    }
    
    // 2. Filtro por Origem (Source)
    if (source && source !== 'all') {
        whereClause += ` AND origin = $${nextIndex++}`;
        values.push(source);
    }

    return { whereClause, values };
};


// ==========================================================
// 📊 REPORT DATA SERVICE
// ==========================================================

class ReportDataService {

    /**
     * Busca métricas de Produtividade, Conversão e Resumo Geral.
     */
    static async getSummaryAndProductivity(whereClause, values) {
        const query = `
            SELECT
                -- Total de Leads
                COALESCE(COUNT(*), 0) AS total_leads,
                
                -- Vendas (Ganhas)
                COALESCE(SUM(CASE WHEN status = 'Fechado Ganho' THEN 1 ELSE 0 END), 0) AS total_won_count,
                
                -- 💥 CORREÇÃO DEFINITIVA COM REGEX PARA TRATAR DADOS SUJOS (R$, UNIDADES, ETC.)
                COALESCE(
                    SUM(
                        CASE 
                            WHEN status = 'Fechado Ganho' THEN 
                                regexp_replace(
                                    REPLACE(NULLIF(TRIM(avg_consumption), ''), ',', '.'), 
                                    '[^0-9.]', 
                                    '', 
                                    'g'
                                )::numeric
                            ELSE 
                                0 
                        END
                    ), 
                    0
                ) AS total_won_value_kw,
                
                -- Perdas (Perdidas)
                COALESCE(SUM(CASE WHEN status = 'Fechado Perdido' THEN 1 ELSE 0 END), 0) AS total_lost_count,
                
                -- Conversão de Vendas (Leads Ganhas / Total de Leads)
                COALESCE(
                    (SUM(CASE WHEN status = 'Fechado Ganho' THEN 1 ELSE 0 END)::numeric * 100) / NULLIF(COUNT(*), 0), 
                    0
                ) AS conversion_rate_percent,
                
                -- Tempo Médio de Fechamento (em dias)
                COALESCE(
                    AVG(
                        EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400
                    ), 
                    0
                ) AS avg_closing_time_days

            FROM leads
            ${whereClause};
        `;
        
        try {
            const result = await pool.query(query, values);
            const data = result.rows[0];
            if (!data) return null;

            return {
                totalLeads: parseInt(data.total_leads || 0),
                totalWonCount: parseInt(data.total_won_count || 0),
                totalWonValueKW: parseFloat(data.total_won_value_kw || 0), 
                totalLostCount: parseInt(data.total_lost_count || 0),
                conversionRate: parseFloat(data.conversion_rate_percent || 0) / 100, 
                avgClosingTimeDays: parseFloat(data.avg_closing_time_days || 0),
            };

        } catch (error) {
            // Este log detalhado é a chave: se falhar, o Render mostrará o erro SQL exato
            console.error('CRITICAL SQL ERROR in getSummaryAndProductivity:', error.message, 'Query:', query, 'Values:', values);
            throw error; 
        }
    }
    
    // --- Funções Auxiliares (mantidas robustas) ---
    
    static async getFunnelData(filters, userId, isAdmin) {
        const { whereClause, values } = buildFilter(filters, userId, isAdmin);
        const query = `
            SELECT status AS stage_name, COUNT(*) AS count
            FROM leads ${whereClause}
            GROUP BY status
            ORDER BY count DESC;
        `;
        try {
            const result = await pool.query(query, values);
            return result.rows.map(row => ({ stageName: row.stage_name, count: parseInt(row.count || 0) }));
        } catch (error) {
            console.error('CRITICAL SQL ERROR in getFunnelData:', error.message);
            throw error;
        }
    }
    
    static async getLostReasonsData(filters, userId, isAdmin) {
        const { whereClause, values } = buildFilter(filters, userId, isAdmin);
        const totalLostQuery = `
            SELECT COALESCE(COUNT(*), 0) AS total_lost
            FROM leads ${whereClause} AND status = 'Fechado Perdido';
        `;
        const reasonsQuery = `
            SELECT lost_reason AS reason, COUNT(*) AS count
            FROM leads ${whereClause}
            AND status = 'Fechado Perdido' AND lost_reason IS NOT NULL 
            GROUP BY lost_reason ORDER BY count DESC;
        `;
        try {
            const [totalLostResult, reasonsResult] = await Promise.all([
                pool.query(totalLostQuery, values),
                pool.query(reasonsQuery, values)
            ]);
            const totalLostCount = parseInt(totalLostResult.rows[0]?.total_lost || 0);
            return {
                reasons: reasonsResult.rows.map(row => ({ reason: row.reason, count: parseInt(row.count || 0) })),
                totalLost: totalLostCount
            };
        } catch (error) {
            console.error('CRITICAL SQL ERROR in getLostReasonsData:', error.message);
            throw error;
        }
    }
    
    static async getDailyActivity(filters, userId, isAdmin) {
        const { whereClause, values } = buildFilter(filters, userId, isAdmin);
        const query = `
            SELECT created_at::date AS activity_date, COUNT(*) AS leads_created
            FROM leads ${whereClause}
            GROUP BY created_at::date ORDER BY created_at::date ASC;
        `;
        try {
            const result = await pool.query(query, values);
            return result.rows.map(row => ({ date: row.activity_date, count: parseInt(row.leads_created || 0) }));
        } catch (error) {
            console.error('CRITICAL SQL ERROR in getDailyActivity:', error.message);
            throw error;
        }
    }

    // --- Função Master ---

    static async getAllDashboardData(filters, userId, isAdmin) {
        try {
            const { whereClause, values } = buildFilter(filters, userId, isAdmin);

            const [
                summaryAndProd, funnel, lostReasons, dailyActivity,
            ] = await Promise.all([
                ReportDataService.getSummaryAndProductivity(whereClause, values),
                ReportDataService.getFunnelData(filters, userId, isAdmin),
                ReportDataService.getLostReasonsData(filters, userId, isAdmin),
                ReportDataService.getDailyActivity(filters, userId, isAdmin),
            ]);
            
            return {
                globalSummary: summaryAndProd, 
                productivity: { ...summaryAndProd },
                funnel: funnel,
                lostReasons: lostReasons,
                dailyActivity: dailyActivity,
                forecasting: { forecastedKwWeighted: 0 }
            };
            
        } catch (error) {
            // O ReportController pega este erro e retorna o 500 com a mensagem detalhada.
            console.error('CRITICAL ERROR in ReportDataService.getAllDashboardData:', error);
            throw error; 
        }
    }
    
    // --- Função Exportação ---

    static async getLeadsForExport(filters, userId, isAdmin) {
        const { whereClause, values } = buildFilter(filters, userId, isAdmin);
        const exportQuery = `
            SELECT l.*, u.name AS owner_name
            FROM leads l LEFT JOIN users u ON u.id = l.owner_id
            ${whereClause} ORDER BY l.created_at DESC;
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