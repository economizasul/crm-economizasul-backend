// services/ReportDataService.js
const { pool } = require('../db');
const Lead = require('../models/Lead'); // Necessário para acessar o pool e métodos base
const Note = require('../models/Note'); // **NOVA DEPENDÊNCIA** para Anotações/Atendimentos

class ReportDataService {

    // --- UTILS ---

    // Helper para formatar filtros de data e vendedor
    static getFilterClauses(filters, values, paramIndex) {
        let query = ' ';
        const { startDate, endDate, ownerId, source } = filters;

        // FILTRO DE DATA: Consideramos leads criados no período
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

    // --- MÉTODOS DE CÁLCULO DE MÉTRICAS ---

    // 1. Métricas de Resumo (KPIs) - Visão Global
    static async getSummaryMetrics(filters, userRole, userId) {
        const values = [];
        let paramIndex = 1;
        let ownerClause = '';

        // Filtro de permissão
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

            const totalLeads = Number(data.total_leads);
            const wonLeadsQty = Number(data.won_leads_qty);
            const lostLeadsQty = Number(data.lost_leads_qty);

            // Cálculos derivados
            const conversionRate = totalLeads > 0 
                ? (wonLeadsQty / totalLeads) * 100 
                : 0;
            
            const churnRate = totalLeads > 0 
                ? (lostLeadsQty / totalLeads) * 100
                : 0;

            return {
                totalLeads: totalLeads,
                activeLeads: Number(data.active_leads),
                wonLeadsQty: wonLeadsQty,
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
        let ownerClause = '';

        if (filters.ownerId && filters.ownerId !== 'all') {
            ownerClause = ` AND l.owner_id = $${paramIndex}`;
            values.push(filters.ownerId);
            paramIndex++;
        }

        const { query: filterQuery, paramIndex: nextIndex } = this.getFilterClauses(filters, values, paramIndex);

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
                COUNT(CASE WHEN l.status = 'Ganho' THEN 1 END) AS won_leads,
                COUNT(CASE WHEN l.status = 'Perdido' THEN 1 END) AS lost_leads
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
                lostLeads: Number(row.lost_leads),
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
            WHERE l.status = 'Perdido' ${filterQuery} AND l.reason_for_loss IS NOT NULL AND l.reason_for_loss <> ''
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
                    ? ((Number(row.count) / totalLost) * 100).toFixed(2) 
                    : '0.00'
            }));
        } catch (error) {
            console.error('Erro ao buscar razões de perda:', error);
            throw error;
        }
    }

    // 5. Relatório de Previsão de Vendas (Forecasting)
    static async getForecastingData(filters) {
        const values = [];
        let paramIndex = 1;

        const { query: filterQuery, paramIndex: nextIndex } = this.getFilterClauses(filters, values, paramIndex);

        // Probabilidades ponderadas (ajuste conforme a realidade do seu negócio)
        const PROBABILITIES = {
            'Em Negociação': 0.40,
            'Proposta Enviada': 0.80,
            // Outras fases:
            'Retorno Agendado': 0.20,
            'Primeiro Contato': 0.10,
            'Novo': 0.05,
        };

        // Construção da soma ponderada (utilizando o avg_consumption como valor da oportunidade)
        const weightedSumCase = Object.entries(PROBABILITIES).map(([stage, prob]) => {
            return `COALESCE(SUM(CASE WHEN l.status = '${stage}' THEN l.avg_consumption * ${prob} ELSE 0 END), 0)`;
        }).join(' + ');
        
        const totalOpportunitiesCase = Object.entries(PROBABILITIES).map(([stage]) => {
            return `COALESCE(SUM(CASE WHEN l.status = '${stage}' THEN l.avg_consumption ELSE 0 END), 0)`;
        }).join(' + ');

        const query = `
            SELECT
                (${weightedSumCase}) AS forecasted_kw_weighted,
                (${totalOpportunitiesCase}) AS total_kw_opportunities
            FROM leads l
            WHERE l.status NOT IN ('Ganho', 'Perdido') ${filterQuery};
        `;

        try {
            const result = await pool.query(query, values);
            const data = result.rows[0];

            return {
                forecastedKwWeighted: Number(data.forecasted_kw_weighted),
                totalKwOpportunities: Number(data.total_kw_opportunities),
            };

        } catch (error) {
            console.error('Erro ao buscar previsão de vendas:', error);
            throw error;
        }
    }
    
    // 6. Relatório de Resposta e Engajamento (Atividade Diária/Semanal)
    static async getDailyActivityData(filters) {
        const values = [];
        let paramIndex = 1;

        // Se o filtro 'ownerId' for específico, aplicamos o WHERE nas anotações
        let ownerClause = '';
        if (filters.ownerId && filters.ownerId !== 'all') {
            ownerClause = ` AND n.user_id = $${paramIndex}`;
            values.push(filters.ownerId);
            paramIndex++;
        }

        const { query: filterQuery, paramIndex: nextIndex } = this.getFilterClauses(filters, values, paramIndex);

        // NOTA: O filtro de data aqui é aplicado na CRIAÇÃO DO LEAD, mas 
        // a atividade conta o número de notas no período.
        const notesQuery = `
            SELECT
                u.id AS vendor_id,
                u.name AS vendor_name,
                COUNT(n.id) AS total_activities,
                COUNT(CASE WHEN n.type = 'Ligação' THEN 1 END) AS calls,
                COUNT(CASE WHEN n.type = 'Email' THEN 1 END) AS emails,
                COUNT(CASE WHEN n.type = 'Reunião' THEN 1 END) AS meetings,
                COUNT(CASE WHEN n.type = 'Nota' THEN 1 END) AS notes
            FROM notes n
            JOIN users u ON n.user_id = u.id
            WHERE n.created_at BETWEEN $1 AND $2 ${ownerClause}
            GROUP BY u.id, u.name
            ORDER BY total_activities DESC;
        `;
        
        // Ajuste dos valores para a query de notas
        const notesValues = [
            filters.startDate + ' 00:00:00',
            filters.endDate + ' 23:59:59',
        ];
        if (filters.ownerId && filters.ownerId !== 'all') {
            notesValues.push(filters.ownerId);
        }

        try {
            const activityResult = await pool.query(notesQuery, notesValues);
            
            // Simulação de Retorno Agendado/Primeiro Contato (requer mais lógica de transição no CRM)
            // Por simplicidade, retornamos apenas a atividade e assumimos que a UI fará o cálculo.
            // Para "Tempo Médio de Resposta", precisaríamos rastrear o tempo entre a criação do Lead
            // e a primeira anotação, o que é complexo para uma única query.

            return activityResult.rows.map(row => ({
                vendorId: row.vendor_id,
                vendorName: row.vendor_name,
                totalActivities: Number(row.total_activities),
                calls: Number(row.calls),
                emails: Number(row.emails),
                meetings: Number(row.meetings),
                notes: Number(row.notes),
                // Taxa de Retorno Agendado/Primeiro Contato (0% por enquanto, precisa de campo no Lead)
                scheduledReturnRate: '0.00', 
            }));

        } catch (error) {
            console.error('Erro ao buscar atividade diária/semanal:', error);
            throw error;
        }
    }

    // 7. Relatório Analítico de Atendimento (Novo)
    static async getAnalyticNotes(leadId, stage, userRole, userId) {
        // Busca notas de um LEAD ESPECÍFICO (histórico completo)
        if (leadId) {
            const notes = await Note.findByLeadId(leadId);
            return { type: 'lead', leadId, notes };
        }

        // Busca leads ATIVOS EM UMA FASE ESPECÍFICA (para análise de estagnação)
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

    // --- AGREGADOR PRINCIPAL (Chamado pelo ReportController) ---

    // Agrega todos os dados do dashboard em uma única chamada otimizada.
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
    
    // Método para Exportação (CSV e PDF)
    static async getLeadsForExport(filters, userId, isAdmin) {
        const values = [];
        let paramIndex = 1;
        let ownerClause = '';
        
        const userRole = isAdmin ? 'Admin' : 'User';

        if (userRole !== 'Admin') {
            ownerClause = ` AND owner_id = $${paramIndex}`;
            values.push(userId);
            paramIndex++;
        } else if (filters.ownerId && filters.ownerId !== 'all') {
            ownerClause = ` AND owner_id = $${paramIndex}`;
            values.push(filters.ownerId);
            paramIndex++;
        }

        const { query: filterQuery, paramIndex: nextIndex } = this.getFilterClauses(filters, values, paramIndex);

        const query = `
            SELECT
                l.id, l.name, l.phone, l.email, l.status, l.origin, l.avg_consumption, l.reason_for_loss, l.created_at,
                u.name AS owner_name
            FROM leads l
            JOIN users u ON l.owner_id = u.id
            WHERE 1=1 ${ownerClause} ${filterQuery}
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