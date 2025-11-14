// services/ReportDataService.js (COMPLETO E CORRIGIDO)
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
        // Admin: se o filtro 'Vendedor' for aplicado (ownerId diferente de 'all')
        whereClause += ` AND owner_id = $${nextIndex++}`;
        // O ownerId do filtro é uma string que deve ser convertida para número se for um ID
        values.push(ownerId); 
    }
    
    // 2. Filtro por Origem (Source)
    if (source && source !== 'all') {
        whereClause += ` AND origin = $${nextIndex++}`;
        values.push(source);
    }

    return { whereClause, values, nextIndex };
};

class ReportDataService {

    // ==========================================================
    // 📊 MÉTICAS DE VISÃO GERAL (GLOBAL - IGNORA FILTRO DE DATA)
    // ==========================================================
    
    /**
     * Busca as métricas de visão geral (Total Leads, KW Vendido, Conversão, Fechamento)
     * desconsiderando o filtro de data, mas respeitando o owner_id para 'User'.
     */
    static async getGlobalMetrics(userId, isAdmin) {
        let ownerFilterClause = ``;
        const values = [];

        // Aplica filtro de usuário se não for Admin
        if (!isAdmin) {
            ownerFilterClause += ` WHERE owner_id = $1`;
            values.push(userId);
        }
        
        // Query principal para métricas globais
        const query = `
            SELECT
                COUNT(id) AS total_leads,
                SUM(CASE WHEN status = 'Ganho' THEN avg_consumption ELSE 0 END) AS total_won_kw,
                COUNT(CASE WHEN status = 'Ganho' THEN 1 END) AS total_won_count,
                COUNT(CASE WHEN status = 'Perdido' THEN 1 END) AS total_lost_count,
                -- Tempo Médio de Fechamento (em dias)
                AVG(CASE WHEN status = 'Ganho' THEN EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400.0 END) AS avg_closing_time_days
            FROM leads
            ${ownerFilterClause};
        `;

        const result = await pool.query(query, values);
        const data = result.rows[0];

        const totalWon = parseInt(data.total_won_count || 0);
        const totalLost = parseInt(data.total_lost_count || 0);
        const totalClosed = totalWon + totalLost;
        
        return {
            totalLeads: parseInt(data.total_leads || 0),
            totalWonValueKW: parseFloat(data.total_won_kw || 0),
            // Taxa de Conversão: Ganho / (Ganho + Perdido)
            conversionRate: totalClosed > 0 ? (totalWon / totalClosed) : 0, 
            avgClosingTimeDays: parseFloat(data.avg_closing_time_days || 0),
        };
    }

    // ==========================================================
    // 📈 MÉTICAS DE PRODUTIVIDADE (COM FILTROS)
    // ==========================================================

    /**
     * Busca as métricas de produtividade (com filtros de data, vendedor e origem)
     */
    static async getProductivityMetrics(filters, userId, isAdmin) {
        // Usa a função auxiliar buildFilter para aplicar todos os filtros (data, owner, source)
        const { whereClause, values } = buildFilter(filters, userId, isAdmin);

        // Esta é a query de produtividade que respeita os filtros
        const query = `
            SELECT
                COUNT(id) AS total_leads,
                -- Leads Ativos: diferente de Ganho e Perdido
                COUNT(CASE WHEN status NOT IN ('Ganho', 'Perdido') THEN 1 END) AS leads_active,
                -- Vendas Concluídas (Qtd)
                COUNT(CASE WHEN status = 'Ganho' THEN 1 END) AS total_won_count,
                -- Leads Perdidos
                COUNT(CASE WHEN status = 'Perdido' THEN 1 END) AS total_lost_count,
                -- Valor Total (kW): somente Ganho
                SUM(CASE WHEN status = 'Ganho' THEN avg_consumption ELSE 0 END) AS total_won_kw,
                SUM(CASE WHEN status = 'Ganho' THEN estimated_savings ELSE 0 END) AS total_won_savings,
                -- Tempo Médio de Fechamento: somente Ganho
                AVG(CASE WHEN status = 'Ganho' THEN EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400.0 END) AS avg_closing_time_days
            FROM leads
            ${whereClause};
        `;
        
        const result = await pool.query(query, values);
        const data = result.rows[0];

        const totalWon = parseInt(data.total_won_count || 0);
        const totalLost = parseInt(data.total_lost_count || 0);
        const totalClosed = totalWon + totalLost;

        const productivity = {
            totalLeads: parseInt(data.total_leads || 0),
            leadsActive: parseInt(data.leads_active || 0),
            totalWonCount: totalWon,
            totalWonValueKW: parseFloat(data.total_won_kw || 0),
            totalWonValueSavings: parseFloat(data.total_won_savings || 0),
            
            // Taxas
            conversionRate: totalClosed > 0 ? (totalWon / totalClosed) : 0,
            lossRate: totalClosed > 0 ? (totalLost / totalClosed) : 0,

            // Tempo
            avgClosingTimeDays: parseFloat(data.avg_closing_time_days || 0),
        };
        
        return productivity;
    }

    // ==========================================================
    // 🚀 FUNÇÃO PRINCIPAL
    // ==========================================================
    
    /**
     * Função principal para o endpoint de dados do dashboard.
     */
    static async getAllDashboardData(filters, userId, isAdmin) {
        try {
            // 1. Métricas de Visão Geral (Global - Ignora filtro de data)
            const globalSummary = await this.getGlobalMetrics(userId, isAdmin);

            // 2. Métricas de Produtividade (Respeita todos os filtros)
            const productivity = await this.getProductivityMetrics(filters, userId, isAdmin);
            
            // 3. Busca Dados para Funil, Motivos de Perda e Atividade Diária
            // 🚨 ATENÇÃO: Os métodos abaixo (getFunnelData, getLostReasonsData, getDailyActivity)
            // DEVEM ser adaptados para usar o 'buildFilter' internamente.
            const funnel = await this.getFunnelData(filters, userId, isAdmin); 
            const lostReasons = await this.getLostReasonsData(filters, userId, isAdmin);
            const dailyActivity = await this.getDailyActivity(filters, userId, isAdmin); 
            
            // Retorno estruturado (Novo campo: globalSummary)
            return {
                globalSummary: globalSummary, // Usado no topo da ReportsPage
                productivity: productivity,   // Usado nos KPIs e na ProductivityTable
                funnel: funnel,
                lostReasons: lostReasons,
                dailyActivity: dailyActivity,
                forecasting: { forecastedKwWeighted: 0 } // Mantido
            };
            
        } catch (error) {
            console.error('CRITICAL ERROR in ReportDataService.getAllDashboardData:', error);
            throw new Error('Falha ao gerar dados de relatório: ' + error.message);
        }
    }
    
    // ==========================================================
    // 🔧 FUNÇÕES AUXILIARES (Placeholders para adaptação)
    // ==========================================================
    
    static async getFunnelData(filters, userId, isAdmin) {
        // Lógica de consulta ao funil aqui, usando 'buildFilter'
        return []; 
    }
    
    static async getLostReasonsData(filters, userId, isAdmin) {
        // Lógica de consulta dos motivos de perda aqui, usando 'buildFilter'
        return { reasons: [], totalLost: 0 }; 
    }
    
    static async getDailyActivity(filters, userId, isAdmin) {
        // Lógica de consulta de atividade diária aqui, usando 'buildFilter'
        return []; 
    }

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