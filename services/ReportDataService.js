// services/ReportDataService.js (COMPLETO E CORRIGIDO)

const { pool } = require('../config/db');
// Removida a dependência de 'date-fns' se ela não for usada na buildFilter (mantenha se você usa format(new Date(), 'yyyy-MM-dd') ou similar)
// const { format } = require('date-fns'); 

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
     * Busca os principais dados do dashboard. Busca o total de Leads Ativos GLOBAL e as métricas FILTRADAS.
     */
    static async getAllDashboardData(filters, userId, isAdmin) {
        // Usa a função auxiliar para construir a cláusula WHERE COM FILTROS
        const { whereClause, values } = buildFilter(filters, userId, isAdmin);
        
        // 1. QUERY GLOBAL: Total de Leads Ativos (IGNORA FILTROS)
        const globalActiveLeadsQuery = `
            SELECT COUNT(*) AS total_global_active
            FROM leads
            WHERE status NOT IN ('Fechado Ganho', 'Fechado Perdido');
        `;
        
        // 2. QUERY FILTRADA: Métrica: Leads Ativos (FILTRADO) - Leads não fechados no período dos filtros
        const leadsActiveQuery = `
            SELECT COUNT(*) AS leads_active
            FROM leads
            ${whereClause} 
            AND status NOT IN ('Fechado Ganho', 'Fechado Perdido');
        `;

        // 3. QUERY FILTRADA: Total de Leads (FILTRADO)
        const totalLeadsQuery = `
            SELECT COUNT(*) AS total_leads
            FROM leads
            ${whereClause};
        `;

        // 4. QUERY FILTRADA: Vendas Ganhas (Quantidade e kW - FILTRADO)
        const wonLeadsQuery = `
            SELECT 
                COUNT(*) AS total_won_count,
                COALESCE(SUM(estimated_savings), 0) AS total_won_value_kw
            FROM leads
            ${whereClause} 
            AND status = 'Fechado Ganho';
        `;

        // 5. QUERY FILTRADA: Vendas Perdidas (Quantidade)
        const lostLeadsCountQuery = `
            SELECT COUNT(*) AS total_lost_count
            FROM leads
            ${whereClause}
            AND status = 'Fechado Perdido';
        `;
        
        // 6. QUERY FILTRADA: Funil (FILTRADO)
        const funnelQuery = `
            SELECT status AS stageName, COUNT(*) AS count
            FROM leads
            ${whereClause}
            GROUP BY status
            ORDER BY count DESC;
        `;

        // 7. QUERY FILTRADA: Motivos de Perda (FILTRADO)
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
        
        // 🚨 Submetendo TODAS as consultas em paralelo
        try {
            const [
                globalActiveLeadsResult, // NOVO
                leadsActiveResult, 
                totalLeadsResult, 
                wonLeadsResult, 
                lostLeadsCountResult,
                funnelResult,
                lostReasonsResult,
                // ... (Inclua os demais resultados)
            ] = await Promise.all([
                pool.query(globalActiveLeadsQuery), // 1. Global (Sem 'values')
                pool.query(leadsActiveQuery, values), // 2. Leads Ativos Filtrado
                pool.query(totalLeadsQuery, values), // 3. Total Leads Filtrado
                pool.query(wonLeadsQuery, values), // 4. Won Leads Filtrado
                pool.query(lostLeadsCountQuery, values), // 5. Lost Count Filtrado
                pool.query(funnelQuery, values), // 6. Funnel Filtrado
                pool.query(lostReasonsQuery, values), // 7. Lost Reasons Filtrado
            ]);
            
            // Conversão de resultados
            const globalActiveLeads = parseInt(globalActiveLeadsResult.rows[0]?.total_global_active) || 0; // NOVO DADO
            
            const leadsActive = parseInt(leadsActiveResult.rows[0]?.leads_active) || 0; // DADO FILTRADO
            const totalLeads = parseInt(totalLeadsResult.rows[0]?.total_leads) || 0; // DADO FILTRADO
            const totalWonCount = parseInt(wonLeadsResult.rows[0]?.total_won_count) || 0; // DADO FILTRADO
            const totalWonValueKW = parseFloat(wonLeadsResult.rows[0]?.total_won_value_kw) || 0; // DADO FILTRADO
            const totalLostCount = parseInt(lostLeadsCountResult.rows[0]?.total_lost_count) || 0; // DADO FILTRADO

            // Cálculos
            const totalClosed = totalWonCount + totalLostCount;
            const conversionRate = totalClosed > 0 ? (totalWonCount / totalClosed) : 0;
            const lossRate = totalClosed > 0 ? (totalLostCount / totalClosed) : 0;
            // TODO: Adicionar lógica real para avgClosingTimeDays

            
            // Monta o objeto de produtividade (filtrado)
            const productivity = {
                leadsActive, // Este é o valor FILTRADO que vai para a tabela
                totalLeads,
                totalWonCount,
                totalLostCount, // Adicionado Lost Count para mais detalhes
                totalWonValueKW,
                conversionRate, 
                lossRate, 
                avgClosingTimeDays: 0, // Placeholder
            };
            
            // Estrutura de retorno final
            const lostReasonsData = {
                reasons: lostReasonsResult.rows.map(row => ({
                    reason: row.reason,
                    count: parseInt(row.count)
                })),
                totalLost: totalLostCount
            };
            
            const funnel = funnelResult.rows.map(row => ({ 
                stageName: row.stageName, 
                count: parseInt(row.count) 
            }));
            
            return {
                productivity,
                funnel,
                lostReasons: lostReasonsData, 
                globalActiveLeads, // 🚨 ADICIONADO AQUI: O valor GLOBAL (sem filtros)
            };
            
        } catch (error) {
            console.error('CRITICAL ERROR in ReportDataService.getAllDashboardData:', error);
            throw new Error('Falha ao gerar dados de relatório: ' + error.message);
        }
    }
    
    // Função auxiliar para exportação (mantida inalterada)
    static async getLeadsForExport(filters, userId, isAdmin) {
        // ... (Lógica de exportação)
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