// services/ReportDataService.js
const { pool } = require('../config/db');
const { format } = require('date-fns');

// ==========================================================
// 🛠️ UTILS DE FILTRAGEM
// ==========================================================

/**
 * Constrói a cláusula WHERE e os valores para as queries SQL, respeitando os filtros.
 * @param {Object} filters - Filtros de data, vendedor (ownerId) e origem (source).
 * @param {number|null} userId - ID do usuário logado (se não for Admin).
 * @param {boolean} isAdmin - Se o usuário é Admin.
 * @returns {Object} { whereClause, values }
 */
const buildFilter = (filters, userId, isAdmin) => {
    // Pega os filtros do frontend
    const { startDate, endDate, ownerId, source } = filters;
    
    // 🚨 CORREÇÃO DE ROBUSTEZ: Define datas padrões (hoje) se faltarem ou forem nulas.
    const defaultDateString = format(new Date(), 'yyyy-MM-dd');

    // Extende as datas para cobrir o dia inteiro.
    // Garante que o valor usado na concatenação nunca é 'undefined'.
    const formattedStartDate = `${startDate || defaultDateString} 00:00:00`;
    const formattedEndDate = `${endDate || defaultDateString} 23:59:59`;
    
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
        // Admin: se o filtro 'ownerId' for aplicado
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
                -- 🚨 Atenção: Verifique se o nome da coluna é exatamente 'estimated_savings'
                COALESCE(SUM(CASE WHEN status = 'Fechado Ganho' THEN estimated_savings ELSE 0 END), 0) AS total_won_value_kw,
                
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
                        -- Se quiser calcular apenas para Fechado Ganho, mude para:
                        /* CASE WHEN status = 'Fechado Ganho' THEN EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400 ELSE NULL END */
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

            // Garante que os retornos são do tipo numérico esperado
            return {
                totalLeads: parseInt(data.total_leads || 0),
                totalWonCount: parseInt(data.total_won_count || 0),
                totalWonValueKW: parseFloat(data.total_won_value_kw || 0),
                totalLostCount: parseInt(data.total_lost_count || 0),
                conversionRate: parseFloat(data.conversion_rate_percent || 0) / 100, // Converte % (0-100) de volta para decimal (0-1)
                avgClosingTimeDays: parseFloat(data.avg_closing_time_days || 0),
            };

        } catch (error) {
            console.error('CRITICAL SQL ERROR in getSummaryAndProductivity:', error.message);
            throw error; // Propaga o erro para ser capturado no Controller
        }
    }
    
    /**
     * Busca a distribuição de leads por estágio do Funil.
     */
    static async getFunnelData(filters, userId, isAdmin) {
        const { whereClause, values } = buildFilter(filters, userId, isAdmin);
        
        const query = `
            SELECT
                status AS stage_name,
                COUNT(*) AS count
            FROM leads
            ${whereClause}
            GROUP BY status
            ORDER BY count DESC;
        `;

        try {
            const result = await pool.query(query, values);
            return result.rows.map(row => ({
                stageName: row.stage_name,
                count: parseInt(row.count || 0)
            }));
        } catch (error) {
            console.error('CRITICAL SQL ERROR in getFunnelData:', error.message);
            throw error;
        }
    }
    
    /**
     * Busca a análise de motivos de perda (Lost Reasons).
     */
    static async getLostReasonsData(filters, userId, isAdmin) {
        const { whereClause, values } = buildFilter(filters, userId, isAdmin);
        
        // 1. Conta o total de leads perdidos no filtro (necessário para calcular a %)
        const totalLostQuery = `
            SELECT COALESCE(COUNT(*), 0) AS total_lost
            FROM leads
            ${whereClause}
            AND status = 'Fechado Perdido';
        `;
        
        // 2. Agrupa os motivos de perda
        const reasonsQuery = `
            SELECT
                lost_reason AS reason,
                COUNT(*) AS count
            FROM leads
            ${whereClause}
            AND status = 'Fechado Perdido'
            AND lost_reason IS NOT NULL 
            GROUP BY lost_reason
            ORDER BY count DESC;
        `;
        
        try {
            const [totalLostResult, reasonsResult] = await Promise.all([
                pool.query(totalLostQuery, values),
                pool.query(reasonsQuery, values)
            ]);
            
            const totalLostCount = parseInt(totalLostResult.rows[0]?.total_lost || 0);
            
            return {
                reasons: reasonsResult.rows.map(row => ({
                    reason: row.reason,
                    count: parseInt(row.count || 0)
                })),
                totalLost: totalLostCount
            };
        } catch (error) {
            console.error('CRITICAL SQL ERROR in getLostReasonsData:', error.message);
            throw error;
        }
    }
    
    /**
     * Busca a atividade de criação de leads por dia.
     */
    static async getDailyActivity(filters, userId, isAdmin) {
        const { whereClause, values } = buildFilter(filters, userId, isAdmin);

        const query = `
            SELECT
                created_at::date AS activity_date,
                COUNT(*) AS leads_created
            FROM leads
            ${whereClause}
            GROUP BY created_at::date
            ORDER BY created_at::date ASC;
        `;
        
        try {
            const result = await pool.query(query, values);
            
            return result.rows.map(row => ({
                date: row.activity_date,
                count: parseInt(row.leads_created || 0)
            }));
        } catch (error) {
            console.error('CRITICAL SQL ERROR in getDailyActivity:', error.message);
            throw error;
        }
    }

    // ==========================================================
    // 🗂️ FUNÇÃO MASTER DE DADOS
    // ==========================================================

    /**
     * Função principal que orquestra a busca de todos os dados do dashboard.
     */
    static async getAllDashboardData(filters, userId, isAdmin) {
        try {
            // Cria os filtros uma única vez para o Summary/Productivity
            const { whereClause, values } = buildFilter(filters, userId, isAdmin);

            // Executa todas as consultas em paralelo para otimizar o tempo de resposta
            const [
                summaryAndProd, // Retorna as métricas e o resumo
                funnel,
                lostReasons,
                dailyActivity,
            ] = await Promise.all([
                // Passa a cláusula WHERE e os valores já criados para evitar recálculo
                ReportDataService.getSummaryAndProductivity(whereClause, values),
                ReportDataService.getFunnelData(filters, userId, isAdmin),
                ReportDataService.getLostReasonsData(filters, userId, isAdmin),
                ReportDataService.getDailyActivity(filters, userId, isAdmin),
            ]);
            
            // Retorna o objeto final que o frontend espera
            return {
                globalSummary: summaryAndProd, // Contém o totalLeads, conversionRate, etc.
                productivity: {
                    // Mapeia para os dados da tabela de produtividade (usa os mesmos dados)
                    ...summaryAndProd 
                },
                funnel: funnel,
                lostReasons: lostReasons,
                dailyActivity: dailyActivity,
                forecasting: {
                    // Placeholder para futura implementação de previsão
                    forecastedKwWeighted: 0 
                }
            };
            
        } catch (error) {
            console.error('CRITICAL ERROR in ReportDataService.getAllDashboardData:', error);
            // Rejeita a promessa para que o ReportController possa capturar e retornar um 500
            throw error;
        }
    }
    
    // ==========================================================
    // 📤 FUNÇÃO DE EXPORTAÇÃO
    // ==========================================================

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