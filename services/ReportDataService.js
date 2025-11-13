// services/ReportDataService.js
const { pool } = require('../db');
const Lead = require('../models/Lead'); // Assume que 'Lead' tem acesso ao pool
const Note = require('../models/Note'); // Nova dependência

class ReportDataService {

    // Helper para formatar filtros de data e vendedor
    static getFilterClauses(filters, values, paramIndex) {
        let query = ' ';
        const { startDate, endDate, ownerId, source } = filters;

        // FILTRO DE DATA: Consideramos apenas leads criados ou que tiveram algum movimento no período
        if (startDate && endDate) {
            query += ` AND l.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
            values.push(startDate + ' 00:00:00');
            values.push(endDate + ' 23:59:59');
            paramIndex += 2;
        }

        // FILTRO POR VENDEDOR
        if (ownerId && ownerId !== 'all') {
            query += ` AND l.owner_id = $${paramIndex}`;
            values.push(ownerId);
            paramIndex++;
        }

        // FILTRO POR ORIGEM (Fonte)
        if (source && source !== 'all') {
            query += ` AND l.origin = $${paramIndex}`;
            values.push(source);
            paramIndex++;
        }

        return { query, paramIndex };
    }

    // 1. Métricas de Resumo (KPIs)
    static async getSummaryMetrics(filters, userRole, userId) {
        const values = [];
        let paramIndex = 1;
        let ownerClause = '';

        // Aplica filtro de permissão
        if (userRole !== 'Admin') {
            ownerClause = ` AND l.owner_id = $${paramIndex}`;
            values.push(userId);
            paramIndex++;
        } else if (filters.ownerId && filters.ownerId !== 'all') {
            ownerClause = ` AND l.owner_id = $${paramIndex}`;
            values.push(filters.ownerId);
            paramIndex++;
        }

        const { query: filterQuery, paramIndex: nextIndex } = this.getFilterClauses(filters, values, paramIndex);

        // Subquery para calcular o tempo médio de fechamento (Ganho - Criação)
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
                COALESCE(SUM(CASE WHEN l.status = 'Ganho' THEN l.avg_consumption ELSE 0 END), 0) AS total_kw_won,
                ${timeToWinQuery}
            FROM leads l
            WHERE 1=1 ${ownerClause} ${filterQuery};
        `;
        
        try {
            const result = await pool.query(query, values);
            const data = result.rows[0];

            // Cálculos derivados
            const conversionRate = data.total_leads > 0 
                ? (data.won_leads_qty / data.total_leads) * 100 
                : 0;
            
            const churnRate = data.total_leads > 0 
                ? (Number(data.total_leads) - Number(data.active_leads) - Number(data.won_leads_qty)) / Number(data.total_leads) * 100
                : 0; // Simplificada: Total - Ativos - Ganhos = Perdidos

            return {
                totalLeads: Number(data.total_leads),
                activeLeads: Number(data.active_leads),
                wonLeadsQty: Number(data.won_leads_qty),
                totalKwWon: Number(data.total_kw_won),
                conversionRate: conversionRate.toFixed(2),
                churnRate: churnRate.toFixed(2),
                avgTimeToWinDays: Number(data.avg_time_to_win_days).toFixed(1),
            };

        } catch (error) {
            console.error('Erro ao buscar métricas de resumo:', error);
            throw error;
        }
    }
    
    // 2. Relatório de Produtividade do Vendedor
    static async getVendorProductivity(filters) {
        const values = [];
        let paramIndex = 1;

        // Se o filtro 'ownerId' for específico, aplicamos o WHERE
        let ownerClause = '';
        if (filters.ownerId && filters.ownerId !== 'all') {
            ownerClause = ` AND l.owner_id = $${paramIndex}`;
            values.push(filters.ownerId);
            paramIndex++;
        }

        const { query: filterQuery, paramIndex: nextIndex } = this.getFilterClauses(filters, values, paramIndex);

        // NOTA: Para valor total de proposta, o schema Lead.js não tem campo de 'valor da proposta'. 
        // Vamos usar avg_consumption como proxy de 'valor da venda em kW'.

        const query = `
            SELECT
                u.id AS vendor_id,
                u.name AS vendor_name,
                COUNT(l.id) AS total_leads_period,
                COUNT(CASE WHEN l.status NOT IN ('Ganho', 'Perdido') THEN 1 END) AS active_leads_qty,
                COUNT(CASE WHEN l.status = 'Ganho' THEN 1 END) AS won_leads_qty,
                COALESCE(SUM(CASE WHEN l.status = 'Ganho' THEN l.avg_consumption ELSE 0 END), 0) AS total_kw_won,
                COALESCE(AVG(EXTRACT(EPOCH FROM l.date_won - l.created_at)) / (60 * 60 * 24), 0) AS avg_time_to_win_days
            FROM leads l
            JOIN users u ON l.owner_id = u.id
            WHERE 1=1 ${ownerClause} ${filterQuery}
            GROUP BY u.id, u.name
            ORDER BY total_kw_won DESC;
        `;

        try {
            const result = await pool.query(query, values);
            
            return result.rows.map(row => ({
                vendorId: row.vendor_id,
                vendorName: row.vendor_name,
                totalLeadsPeriod: Number(row.total_leads_period),
                activeLeadsQty: Number(row.active_leads_qty),
                wonLeadsQty: Number(row.won_leads_qty),
                totalKwWon: Number(row.total_kw_won),
                avgTimeToWinDays: Number(row.avg_time_to_win_days).toFixed(1),
                // Taxa de Conversão: Ganhos / Total de Leads no Período
                conversionRate: row.total_leads_period > 0 
                    ? ((row.won_leads_qty / row.total_leads_period) * 100).toFixed(2) 
                    : '0.00',
            }));

        } catch (error) {
            console.error('Erro ao buscar produtividade do vendedor:', error);
            throw error;
        }
    }
    
    // 3. Análise de Funil por Origem
    static async getFunnelAnalysis(filters) {
        const values = [];
        let paramIndex = 1;

        const { query: filterQuery, paramIndex: nextIndex } = this.getFilterClauses(filters, values, paramIndex);
        
        const query = `
            SELECT
                l.origin,
                COUNT(l.id) AS total_leads,
                COUNT(CASE WHEN l.status = 'Ganho' THEN 1 END) AS won_leads
            FROM leads l
            WHERE 1=1 ${filterQuery}
            GROUP BY l.origin
            ORDER BY total_leads DESC;
        `;
        
        try {
            const result = await pool.query(query, values);
            return result.rows.map(row => ({
                origin: row.origin,
                totalLeads: Number(row.total_leads),
                wonLeads: Number(row.won_leads),
                conversionRate: row.total_leads > 0 
                    ? ((row.won_leads / row.total_leads) * 100).toFixed(2)
                    : '0.00'
            }));
        } catch (error) {
            console.error('Erro ao buscar análise de funil por origem:', error);
            throw error;
        }
    }

    // 4. Relatório de Perdas (Churn)
    static async getLostReasons(filters) {
        const values = [];
        let paramIndex = 1;

        const { query: filterQuery, paramIndex: nextIndex } = this.getFilterClauses(filters, values, paramIndex);

        const query = `
            SELECT
                l.reason_for_loss,
                COUNT(l.id) AS loss_count,
                COALESCE(SUM(l.avg_consumption), 0) AS potential_kw_lost
            FROM leads l
            WHERE l.status = 'Perdido' ${filterQuery} AND l.reason_for_loss IS NOT NULL
            GROUP BY l.reason_for_loss
            ORDER BY loss_count DESC;
        `;
        
        try {
            const result = await pool.query(query, values);
            const totalLost = result.rows.reduce((sum, row) => sum + Number(row.loss_count), 0);

            return result.rows.map(row => ({
                reason: row.reason_for_loss,
                count: Number(row.loss_count),
                potentialKwLost: Number(row.potential_kw_lost),
                percentage: totalLost > 0 
                    ? ((Number(row.loss_count) / totalLost) * 100).toFixed(2) 
                    : '0.00'
            }));
        } catch (error) {
            console.error('Erro ao buscar razões de perda:', error);
            throw error;
        }
    }
    
    // 5. Relatório Analítico de Atendimento (Novo)
    static async getAnalyticNotes(leadId, stage, userRole, userId) {
        // Se leadId for fornecido, buscamos todas as notas desse lead.
        if (leadId) {
            const notes = await Note.findByLeadId(leadId);
            return { type: 'lead', leadId, notes };
        }

        // Se stage for fornecido, buscamos todos os leads nessa fase com as últimas notas.
        if (stage) {
            const values = [stage];
            let paramIndex = 2;
            let ownerClause = '';

            // Filtro de permissão
            if (userRole !== 'Admin') {
                ownerClause = ` AND l.owner_id = $${paramIndex}`;
                values.push(userId);
                paramIndex++;
            }
            
            const query = `
                SELECT
                    l.id AS lead_id,
                    l.name AS lead_name,
                    l.owner_id,
                    u.name AS owner_name,
                    l.status,
                    l.created_at,
                    (SELECT content FROM notes WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) AS last_note_content,
                    (SELECT created_at FROM notes WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) AS last_note_date
                FROM leads l
                JOIN users u ON l.owner_id = u.id
                WHERE l.status = $1 ${ownerClause}
                ORDER BY last_note_date DESC NULLS LAST;
            `;
            
            try {
                const result = await pool.query(query, values);
                return { type: 'stage', stage, leads: result.rows };
            } catch (error) {
                console.error('Erro ao buscar leads por fase para análise de atendimento:', error);
                throw error;
            }
        }

        return { type: 'none', message: 'Nenhum lead ou fase selecionada.' };
    }
    
}

module.exports = ReportDataService;