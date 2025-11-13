// services/ReportDataService.js
// 🚨 ATENÇÃO: Verifique se o caminho do seu pool está correto.
const { pool } = require('../config/db'); // Assumindo que seu pool está em '../config/db'
const Lead = require('../models/Lead'); 
const Note = require('../models/Note'); 

class ReportDataService {

    // --- UTILS ---
    static getFilterClauses(filters, values, paramIndex) {
        let query = ' ';
        const { startDate, endDate, ownerId, source } = filters;

        if (startDate && endDate) {
            query += ` AND l.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
            values.push(startDate + ' 00:00:00');
            values.push(endDate + ' 23:59:59');
            paramIndex += 2;
        }
        if (ownerId && ownerId !== 'all') {
            query += ` AND l.owner_id = $${paramIndex}`;
            values.push(ownerId);
            paramIndex++;
        }
        if (source && source !== 'all') {
            query += ` AND l.origin = $${paramIndex}`;
            values.push(source);
            paramIndex++;
        }
        return { query, paramIndex };
    }

    // --- MÉTODOS DE CÁLCULO DE MÉTRICAS ---

    static async getSummaryMetrics(filters, userRole, userId) {
        const values = [];
        let paramIndex = 1;
        let ownerClause = '';
        
        // Lógica de permissão e filtro do vendedor
        if (userRole !== 'Admin') {
            ownerClause = ` AND l.owner_id = $${paramIndex}`;
            values.push(userId);
            paramIndex++;
        } else if (filters.ownerId && filters.ownerId !== 'all') {
            ownerClause = ` AND l.owner_id = $${paramIndex}`;
            values.push(filters.ownerId);
            paramIndex++;
        }

        const { query: filterQuery } = this.getFilterClauses(filters, values, paramIndex);

        const timeToWinQuery = `
            COALESCE(
                AVG(EXTRACT(EPOCH FROM l.date_won - l.created_at)) / (60 * 60 * 24), 
                0
            ) AS avg_time_to_win_days
        `;

        const query = `
            SELECT
                COUNT(l.id) AS total_leads,
                COUNT(CASE WHEN l.status NOT IN ('Ganho', 'Perdido') THEN 1 END) AS active_leads,
                COUNT(CASE WHEN l.status = 'Ganho' THEN 1 END) AS won_leads_qty,
                COUNT(CASE WHEN l.status = 'Perdido' THEN 1 END) AS lost_leads_qty,
                COALESCE(SUM(CASE WHEN l.status = 'Ganho' THEN l.avg_consumption ELSE 0 END), 0) AS total_kw_won,
                ${timeToWinQuery}
            FROM leads l
            WHERE 1=1 ${ownerClause} ${filterQuery};
        `;
        
        try {
            const result = await pool.query(query, values);
            const data = result.rows[0];

            // Retorna a estrutura esperada pelo Frontend
            return {
                totalLeads: Number(data.total_leads),
                activeLeads: Number(data.active_leads),
                wonLeadsQty: Number(data.won_leads_qty),
                totalKwWon: Number(data.total_kw_won),
                conversionRate: data.total_leads > 0 ? ((data.won_leads_qty / data.total_leads) * 100).toFixed(2) : '0.00',
                churnRate: data.total_leads > 0 ? ((data.lost_leads_qty / data.total_leads) * 100).toFixed(2) : '0.00',
                avgTimeToWinDays: Number(data.avg_time_to_win_days).toFixed(1),
            };

        } catch (error) {
            console.error('Erro ao buscar métricas de resumo (ReportDataService.getSummaryMetrics):', error);
            throw error; // Propaga o erro 500
        }
    }
    
    // (Outras métricas - getVendorProductivity, getFunnelAnalysis, getLostReasons, getForecastingData, getDailyActivityData - não foram alteradas)
    // Se o erro 500 persistir, ele está em uma dessas queries!

    // --- AGREGADOR PRINCIPAL (Chamado pelo ReportController) ---

    static async getAllDashboardData(filters, userId, isAdmin) {
        const userRole = isAdmin ? 'Admin' : 'User';

        // 🚨 Faz todas as chamadas de métricas em paralelo (otimização de performance)
        const [
            summary,
            productivity,
            funnel,
            lostReasons,
            forecasting, 
            dailyActivity 
        ] = await Promise.all([
            this.getSummaryMetrics(filters, userRole, userId),
            this.getVendorProductivity(filters),
            this.getFunnelAnalysis(filters),
            this.getLostReasons(filters),
            this.getForecastingData(filters), 
            this.getDailyActivityData(filters) 
        ]);
        
        // O objeto de retorno final que o Frontend espera
        return {
            summary, 
            productivity,
            funnel,
            lostReasons,
            forecasting,
            dailyActivity
        };
    }
    
    // ... getAnalyticNotes e getLeadsForExport (métodos para exportação e notas analíticas)
}

module.exports = ReportDataService;