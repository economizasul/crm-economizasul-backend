// services/ReportDataService.js

const { pool } = require('../config/db');
// Removida a dependência de 'date-fns' se ela não for usada na buildFilter
// Se você a usa para formatar created_at/date_won, mantenha, mas aqui a removemos para simplificar
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
    // Certifique-se de que startDate e endDate estejam em um formato compatível com o seu banco de dados
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
    
    // 🚨 CORREÇÃO: Função UNIFICADA. 
    // Vamos buscar os dados globais e filtrados em uma única chamada.

    /**
     * Busca os principais dados do dashboard (métricas, funil, etc.) baseados nos filtros.
     * Além disso, busca o total de Leads Ativos GLOBAL (sem filtros de data/vendedor) para o cabeçalho.
     * @param {Object} filters - Os filtros de data, vendedor e origem.
     * @param {number|null} userId - ID do usuário logado.
     * @param {boolean} isAdmin - Se o usuário é Admin.
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

        // ... (Inclua as outras queries filtradas: lostLeadsCountQuery, avgClosingTimeQuery, funnelQuery, lostReasonsQuery)
        // Por brevidade e foco na correção, assumo que você irá incluir as demais queries aqui.
        
        // Exemplo: Funil (FILTRADO)
        const funnelQuery = `
            SELECT status AS stageName, COUNT(*) AS count
            FROM leads
            ${whereClause}
            GROUP BY status
            ORDER BY count DESC;
        `;
        
        // 🚨 Submetendo TODAS as consultas em paralelo
        try {
            const [
                globalActiveLeadsResult, // NOVO
                leadsActiveResult, 
                totalLeadsResult, 
                wonLeadsResult, 
                funnelResult,
                // ... (Inclua os demais resultados)
            ] = await Promise.all([
                pool.query(globalActiveLeadsQuery), // Sem 'values'
                pool.query(leadsActiveQuery, values), // Com 'values'
                pool.query(totalLeadsQuery, values), 
                pool.query(wonLeadsQuery, values), 
                pool.query(funnelQuery, values),
                // ... (Inclua os demais pool.query(s) aqui)
            ]);
            
            // Conversão de resultados
            const globalActiveLeads = parseInt(globalActiveLeadsResult.rows[0]?.total_global_active) || 0; // NOVO DADO
            const leadsActive = parseInt(leadsActiveResult.rows[0]?.leads_active) || 0; // DADO FILTRADO
            const totalLeads = parseInt(totalLeadsResult.rows[0]?.total_leads) || 0; // DADO FILTRADO
            const totalWonCount = parseInt(wonLeadsResult.rows[0]?.total_won_count) || 0; // DADO FILTRADO
            const totalWonValueKW = parseFloat(wonLeadsResult.rows[0]?.total_won_value_kw) || 0; // DADO FILTRADO
            // ... (Converta os demais resultados)
            
            // Monta o objeto de produtividade (filtrado)
            const productivity = {
                leadsActive, // Este é o valor FILTRADO que vai para a tabela
                totalLeads,
                totalWonCount,
                totalWonValueKW,
                // ... (Inclua as outras métricas filtradas)
                conversionRate: 0, // Exemplo
                lossRate: 0, // Exemplo
                avgClosingTimeDays: 0, // Exemplo
            };
            
            // Estrutura de retorno final
            return {
                productivity,
                funnel: funnelResult.rows.map(row => ({ stageName: row.stageName, count: parseInt(row.count) })),
                // lostReasons, dailyActivity...
                globalActiveLeads, // 🚨 ADICIONADO AQUI: O valor GLOBAL (sem filtros)
            };
            
        } catch (error) {
            console.error('CRITICAL ERROR in ReportDataService.getAllDashboardData:', error);
            throw new Error('Falha ao gerar dados de relatório: ' + error.message);
        }
    }
    
    // ... (restante da classe ReportDataService: getLeadsForExport)
}

module.exports = ReportDataService;