// services/ReportDataService.js
const { pool } = require('../config/db');
const { format } = require('date-fns'); 

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
    
    // 🚨 CORREÇÃO DE DATA: Garante que sempre haja uma data válida e estende a data final.
    const today = format(new Date(), 'yyyy-MM-dd');
    const start = startDate || today; 
    const end = endDate || today;     

    // Extende as datas para cobrir o dia inteiro
    const formattedStartDate = `${start} 00:00:00`;
    const formattedEndDate = `${end} 23:59:59`;
    
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
        // Admin pode filtrar por vendedor específico 
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
// 📈 SERVIÇO DE DADOS DE RELATÓRIO (MÉTODOS AGORA DENTRO DA CLASSE)
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
                    -- Calcula o tempo de fechamento em dias. NULL se não tiver sido ganho.
                    EXTRACT(EPOCH FROM (date_won - created_at)) / 86400 AS time_to_close_days 
                FROM leads 
                ${whereClause}
            )
            SELECT 
                COUNT(*) AS total_leads, -- Total de Leads no Filtro
                
                -- Ganhos (Won)
                COUNT(*) FILTER (WHERE status = 'Fechado Ganho') AS total_won_count,
                COALESCE(SUM(estimated_savings) FILTER (WHERE status = 'Fechado Ganho'), 0) AS total_won_value_savings,
                COALESCE(SUM(avg_consumption) FILTER (WHERE status = 'Fechado Ganho'), 0) AS total_won_value_kw,

                -- Perdidos (Lost)
                COUNT(*) FILTER (WHERE status = 'Fechado Perdido') AS total_lost_count,
                
                -- Conversão/Perda
                CAST(COUNT(*) FILTER (WHERE status = 'Fechado Ganho') AS NUMERIC) / NULLIF(COUNT(*), 0) AS conversion_rate,
                CAST(COUNT(*) FILTER (WHERE status = 'Fechado Perdido') AS NUMERIC) / NULLIF(COUNT(*), 0) AS loss_rate,
                
                -- Tempo de Fechamento (Média em dias)
                COALESCE(AVG(time_to_close_days) FILTER (WHERE status = 'Fechado Ganho'), 0) AS avg_closing_time_days
                
            FROM FilteredLeads;
        `;

        const result = await pool.query(query, values);
        
        // Mapeamento e parse do resultado (garante que os números são tipos JS)
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

        // 1. Contagem total de perdidos (para o cálculo da porcentagem no frontend)
        const totalLostQuery = `
            SELECT COUNT(*) AS total_lost 
            FROM leads 
            ${whereClause} AND status = 'Fechado Perdido';
        `;
        const totalLostResult = await pool.query(totalLostQuery, values);
        const totalLostCount = parseInt(totalLostResult.rows[0]?.total_lost || 0);

        // 2. Contagem por motivo de perda
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
            // As queries são executadas em paralelo
            const [
                summaryAndProd, 
                funnelData, 
                lostReasons,
            ] = await Promise.all([
                // Chamadas usando 'this.' funcionam corretamente para métodos estáticos
                this.getSummaryAndProductivity(filters, userId, isAdmin),
                this.getFunnelData(filters, userId, isAdmin),
                this.getLostReasons(filters, userId, isAdmin),
            ]);
            
            // Combina os resultados
            return {
                productivity: {
                    ...summaryAndProd 
                },
                funnel: funnelData,
                lostReasons: lostReasons,
                dailyActivity: [], // Mantenha como array vazio se não estiver implementado
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