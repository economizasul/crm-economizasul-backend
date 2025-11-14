// services/ReportDataService.js
const { pool } = require('../config/db');
const { format } = require('date-fns');

// ==========================================================
// 🛠️ UTILS DE FILTRAGEM
// ==========================================================

/**
 * Constrói a cláusula WHERE e os valores para as queries SQL, respeitando os filtros de data e vendedor.
 * Esta função é usada para as Métricas de Produtividade (com filtros).
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
        // Admin: se o filtro 'ownerId' for aplicado
        whereClause += ` AND owner_id = $${nextIndex++}`;
        values.push(parseInt(ownerId));
    }

    // 2. Filtro por Origem (Source)
    if (source && source !== 'all') {
        whereClause += ` AND origin = $${nextIndex++}`;
        values.push(source);
    }
    
    // Retorna a cláusula WHERE e os valores
    return { whereClause, values };
};


// ==========================================================
// 📊 REPORT DATA SERVICE
// ==========================================================

class ReportDataService {
    
    /**
     * NOVO MÉTODO: Busca o total de leads ativos globalmente (ignora todos os filtros).
     * Leads Ativos = leads que NÃO estão em Fechado Ganho ou Fechado Perdido.
     */
    static async getGlobalActiveLeadsCount() {
        const query = `
            SELECT COUNT(*) AS total_active
            FROM leads
            WHERE status NOT IN ('Fechado Ganho', 'Fechado Perdido');
        `;
        try {
            const result = await pool.query(query);
            // Retorna o total como número inteiro
            return parseInt(result.rows[0]?.total_active) || 0;
        } catch (error) {
            console.error('Erro ao buscar total de leads ativos global:', error);
            throw error;
        }
    }

    /**
     * Busca os principais dados do dashboard (métricas, funil, etc.) baseados nos filtros.
     * @param {Object} filters - Os filtros de data, vendedor e origem.
     * @param {number|null} userId - ID do usuário logado.
     * @param {boolean} isAdmin - Se o usuário é Admin.
     */
    static async getAllDashboardData(filters, userId, isAdmin) {
        // Usa a função auxiliar para construir a cláusula WHERE COM FILTROS
        const { whereClause, values } = buildFilter(filters, userId, isAdmin);
        
        // Métrica: Leads Ativos (Filtrado) - Leads não fechados no período dos filtros
        const leadsActiveQuery = `
            SELECT COUNT(*) AS leads_active
            FROM leads
            ${whereClause} 
            AND status NOT IN ('Fechado Ganho', 'Fechado Perdido');
        `;

        // Métrica: Total de Leads (Filtrado)
        const totalLeadsQuery = `
            SELECT COUNT(*) AS total_leads
            FROM leads
            ${whereClause};
        `;

        // Métrica: Vendas Ganhas (Quantidade e kW - Filtrado)
        const wonLeadsQuery = `
            SELECT 
                COUNT(*) AS total_won_count,
                COALESCE(SUM(estimated_savings), 0) AS total_won_value_kw
            FROM leads
            ${whereClause} 
            AND status = 'Fechado Ganho';
        `;

        // Métrica: Leads Perdidos (Quantidade - Filtrado)
        const lostLeadsCountQuery = `
            SELECT 
                COUNT(*) AS total_lost_count
            FROM leads
            ${whereClause} 
            AND status = 'Fechado Perdido';
        `;

        // Métrica: Tempo Médio de Fechamento (Dias - Filtrado)
        const avgClosingTimeQuery = `
            SELECT 
                COALESCE(AVG(EXTRACT(EPOCH FROM date_won - created_at) / 86400), 0) AS avg_closing_time_days
            FROM leads
            ${whereClause} 
            AND status = 'Fechado Ganho' 
            AND date_won IS NOT NULL;
        `;
        
        // Funil: Agrupamento por status (Filtrado)
        const funnelQuery = `
            SELECT status AS stageName, COUNT(*) AS count
            FROM leads
            ${whereClause}
            GROUP BY status
            ORDER BY count DESC;
        `;
        
        // Motivos de Perda (Filtrado)
        const lostReasonsQuery = `
            SELECT 
                reason_for_loss AS reason, 
                COUNT(*) AS count
            FROM leads
            ${whereClause} 
            AND status = 'Fechado Perdido'
            AND reason_for_loss IS NOT NULL
            GROUP BY reason_for_loss
            ORDER BY count DESC;
        `;

        // 🚨 Submetendo todas as consultas em paralelo para otimizar a velocidade
        try {
            const [
                leadsActiveResult, 
                totalLeadsResult, 
                wonLeadsResult, 
                lostLeadsCountResult,
                avgClosingTimeResult,
                funnelResult,
                lostReasonsResult
            ] = await Promise.all([
                pool.query(leadsActiveQuery, values),
                pool.query(totalLeadsQuery, values),
                pool.query(wonLeadsQuery, values),
                pool.query(lostLeadsCountQuery, values),
                pool.query(avgClosingTimeQuery, values),
                pool.query(funnelQuery, values),
                pool.query(lostReasonsQuery, values)
            ]);
            
            // Conversão de resultados
            const leadsActive = parseInt(leadsActiveResult.rows[0]?.leads_active) || 0;
            const totalLeads = parseInt(totalLeadsResult.rows[0]?.total_leads) || 0;
            const totalWonCount = parseInt(wonLeadsResult.rows[0]?.total_won_count) || 0;
            const totalWonValueKW = parseFloat(wonLeadsResult.rows[0]?.total_won_value_kw) || 0;
            const totalLostCount = parseInt(lostLeadsCountResult.rows[0]?.total_lost_count) || 0;
            const avgClosingTimeDays = parseFloat(avgClosingTimeResult.rows[0]?.avg_closing_time_days) || 0;
            
            // Cálculo de taxas
            const totalClosed = totalWonCount + totalLostCount;
            const conversionRate = totalClosed > 0 ? totalWonCount / totalClosed : 0;
            const lossRate = totalClosed > 0 ? totalLostCount / totalClosed : 0;
            
            // Funil
            const funnel = funnelResult.rows.map(row => ({
                stageName: row.stageName,
                count: parseInt(row.count)
            }));
            
            // Motivos de Perda
            const lostReasonsData = {
                reasons: lostReasonsResult.rows.map(row => ({
                    reason: row.reason,
                    count: parseInt(row.count)
                })),
                totalLost: totalLostCount // Reutiliza a contagem geral
            };
            
            // Monta o objeto de produtividade (filtrado)
            const productivity = {
                leadsActive,
                totalLeads,
                totalWonCount,
                totalWonValueKW,
                totalLostCount,
                conversionRate,
                lossRate,
                avgClosingTimeDays,
            };
            
            // Estrutura de retorno final
            return {
                productivity,
                funnel,
                lostReasons: lostReasonsData,
                // dailyActivity: [], // Adicione aqui se houver uma consulta de atividade diária
            };
            
        } catch (error) {
            console.error('CRITICAL ERROR in ReportDataService.getAllDashboardData:', error);
            throw new Error('Falha ao gerar dados de relatório: ' + error.message);
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