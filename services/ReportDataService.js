// services/ReportDataService.js
const { pool } = require('../config/db');
// O require('date-fns') foi removido para evitar a dependência e o crash.

// ==========================================================
// 🛠️ UTILS DE FILTRAGEM
// ==========================================================

/**
 * Converte um objeto Date em formato YYYY-MM-DD (nativa, sem dependências).
 */
const formatDate = (date) => {
    const d = new Date(date);
    // Extrai e formata Mês e Dia para garantir que tenham dois dígitos (ex: 01)
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) 
        month = '0' + month;
    if (day.length < 2) 
        day = '0' + day;

    return [year, month, day].join('-'); // Retorna 'YYYY-MM-DD'
};


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
    
    // 🚨 CORREÇÃO DE DATA: Usa a função formatDate nativa para criar a data padrão
    const today = formatDate(new Date()); 
    const start = startDate || today; // Data inicial, ou hoje como padrão
    const end = endDate || today;     // Data final, ou hoje como padrão

    // CRÍTICO: Estende as datas para cobrir o dia inteiro (00:00:00 até 23:59:59)
    const formattedStartDate = `${start} 00:00:00`;
    const formattedEndDate = `${end} 23:59:59`;
    
    // Filtro de data obrigatório (usando a data de criação do lead)
    let whereClause = `WHERE created_at BETWEEN $1 AND $2`;
    const values = [formattedStartDate, formattedEndDate];
    let nextIndex = 3;

    // 1. Filtro por Vendedor (Owner)
    if (!isAdmin) {
        whereClause += ` AND owner_id = $${nextIndex++}`;
        values.push(userId);
    } else if (ownerId && ownerId !== 'all') {
        whereClause += ` AND owner_id = $${nextIndex++}`;
        values.push(typeof ownerId === 'string' ? parseInt(ownerId) : ownerId);
    }
    
    // 2. Filtro por Origem
    if (source && source !== 'all') {
        whereClause += ` AND origin = $${nextIndex++}`;
        values.push(source);
    }
    
    return { whereClause, values };
};

// ==========================================================
// 📈 SERVIÇO DE DADOS DE RELATÓRIO
// ==========================================================

class ReportDataService {
    
    /**
     * Busca o resumo de Leads (Total, Ganhos, Perdidos) e métricas de Produtividade.
     * @static
     */
    static async getSummaryAndProductivity(filters, userId, isAdmin) {
        const { whereClause, values } = buildFilter(filters, userId, isAdmin);

        const query = `
            WITH FilteredLeads AS (
                SELECT
                    *,
                    EXTRACT(EPOCH FROM (date_won - created_at)) / 86400 AS time_to_close_days 
                FROM leads 
                ${whereClause}
            )
            SELECT 
                COUNT(*) AS total_leads, 
                COUNT(*) FILTER (WHERE status = 'Fechado Ganho') AS total_won_count,
                COALESCE(SUM(estimated_savings) FILTER (WHERE status = 'Fechado Ganho'), 0) AS total_won_value_savings,
                COALESCE(SUM(avg_consumption) FILTER (WHERE status = 'Fechado Ganho'), 0) AS total_won_value_kw,
                COUNT(*) FILTER (WHERE status = 'Fechado Perdido') AS total_lost_count,
                CAST(COUNT(*) FILTER (WHERE status = 'Fechado Ganho') AS NUMERIC) / NULLIF(COUNT(*), 0) AS conversion_rate,
                CAST(COUNT(*) FILTER (WHERE status = 'Fechado Perdido') AS NUMERIC) / NULLIF(COUNT(*), 0) AS loss_rate,
                COALESCE(AVG(time_to_close_days) FILTER (WHERE status = 'Fechado Ganho'), 0) AS avg_closing_time_days
            FROM FilteredLeads;
        `;

        const result = await pool.query(query, values);
        
        const row = result.rows[0] || {};
        return {
            totalLeads: parseInt(row.total_leads || 0),
            totalWonCount: parseInt(row.total_won_count || 0),
            totalWonValueSavings: parseFloat(row.total_won_value_savings || 0),
            totalWonValueKW: parseFloat(row.total_won_value_kw || 0),
            totalLostCount: parseInt(row.total_lost_count || 0),
            conversionRate: parseFloat(row.conversion_rate || 0),
            lossRate: parseFloat(row.loss_rate || 0),
            avgClosingTimeDays: parseFloat(row.avg_closing_time_days || 0),
        };
    }

    /**
     * Busca a distribuição de leads pelo status (funil).
     * @static
     */
    static async getFunnelData(filters, userId, isAdmin) {
        const { whereClause, values } = buildFilter(filters, userId, isAdmin);

        const query = `
            SELECT 
                status,
                COUNT(*) AS count
            FROM leads 
            ${whereClause}
            GROUP BY status
            ORDER BY count DESC;
        `;

        const result = await pool.query(query, values);
        
        return result.rows.map(row => ({
            stageName: row.status,
            count: parseInt(row.count)
        }));
    }

    /**
     * Busca a análise dos motivos de perda.
     * @static
     */
    static async getLostReasons(filters, userId, isAdmin) {
        const { whereClause, values } = buildFilter(filters, userId, isAdmin);

        const totalLostQuery = `
            SELECT COUNT(*) AS total_lost 
            FROM leads 
            ${whereClause} AND status = 'Fechado Perdido';
        `;
        const totalLostResult = await pool.query(totalLostQuery, values);
        const totalLostCount = parseInt(totalLostResult.rows[0]?.total_lost || 0);

        const reasonsQuery = `
            SELECT 
                reason_for_loss AS reason,
                COUNT(*) AS count
            FROM leads 
            ${whereClause} AND status = 'Fechado Perdido' AND reason_for_loss IS NOT NULL
            GROUP BY reason_for_loss
            ORDER BY count DESC;
        `;

        const reasonsResult = await pool.query(reasonsQuery, values);
        
        const lostReasonsData = {
            reasons: reasonsResult.rows.map(row => ({
                reason: row.reason,
                count: parseInt(row.count)
            })),
            totalLost: totalLostCount
        };

        return lostReasonsData;
    }


    /**
     * Busca todos os dados necessários para o Dashboard de Relatórios em uma única chamada.
     * @static
     */
    static async getAllDashboardData(filters, userId, isAdmin) {
        try {
            const [
                summaryAndProd, 
                funnelData, 
                lostReasons,
            ] = await Promise.all([
                this.getSummaryAndProductivity(filters, userId, isAdmin),
                this.getFunnelData(filters, userId, isAdmin),
                this.getLostReasons(filters, userId, isAdmin),
            ]);
            
            return {
                productivity: {
                    ...summaryAndProd 
                },
                funnel: funnelData,
                lostReasons: lostReasons,
                dailyActivity: [], 
                forecasting: {
                    forecastedKwWeighted: 0 
                }
            };
            
        } catch (error) {
            console.error('CRITICAL ERROR in ReportDataService.getAllDashboardData:', error);
            throw new Error('Falha ao gerar dados de relatório: ' + error.message);
        }
    }
    
    /**
     * Método auxiliar para buscar leads brutos para a exportação CSV/PDF.
     * @static
     */
    static async getLeadsForExport(filters, userId, isAdmin) {
        const { whereClause, values } = buildFilter(filters, userId, isAdmin);
        
        const query = `
            SELECT 
                l.*, 
                u.name AS owner_name
            FROM leads l
            LEFT JOIN users u ON l.owner_id = u.id
            ${whereClause}
            ORDER BY l.created_at DESC;
        `;
        
        try {
            const result = await pool.query(query, values);
            return result.rows;
        } catch (error) {
            console.error('Erro ao buscar leads para exportação:', error);
            throw error;
        }
    }
}

module.exports = ReportDataService;