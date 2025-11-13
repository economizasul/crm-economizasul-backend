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
    // Nota: O backend deve usar os valores dos filtros do frontend
    const { startDate, endDate, ownerId, source } = filters;
    
    // Filtro de data obrigatório
    let whereClause = `WHERE created_at BETWEEN $1 AND $2`;
    const values = [
        startDate || format(new Date(), 'yyyy-MM-dd'),
        endDate || format(new Date(), 'yyyy-MM-dd'),
    ];
    let nextIndex = 3;

    // 1. Filtro por Vendedor (Owner)
    if (!isAdmin) {
        // Usuário normal vê apenas seus leads
        whereClause += ` AND owner_id = $${nextIndex++}`;
        values.push(userId);
    } else if (ownerId && ownerId !== 'all') {
        // Admin pode filtrar por vendedor específico
        whereClause += ` AND owner_id = $${nextIndex++}`;
        values.push(ownerId);
    }

    // 2. Filtro por Origem (Source)
    if (source && source !== 'all') {
        whereClause += ` AND origin = $${nextIndex++}`;
        values.push(source);
    }
    
    // Os filtros são construídos dinamicamente, os valores são passados corretamente.
    return { whereClause, values };
};

// ==========================================================
// 📊 FUNÇÕES DE BUSCA DE DADOS POR MÉTRICA
// ==========================================================

class ReportDataService {
    
    /**
     * Busca dados agregados para os KPIs de Resumo e Produtividade.
     * @param {Object} filters
     * @param {number|null} userId
     * @param {boolean} isAdmin
     */
    static async getSummaryAndProductivity(filters, userId, isAdmin) {
        const { whereClause, values } = buildFilter(filters, userId, isAdmin);
        
        // 🚨 CORREÇÃO PRINCIPAL: Uso de COALESCE e NULLIF para evitar divisão por zero
        const query = `
            SELECT
                COUNT(id) AS total_leads_created,
                -- Leads Ativos são aqueles que NÃO estão em Fechado Ganho/Perdido
                SUM(CASE WHEN status NOT IN ('Fechado Ganho', 'Fechado Perdido') THEN 1 ELSE 0 END) AS leads_active,
                SUM(CASE WHEN status = 'Fechado Ganho' THEN 1 ELSE 0 END) AS total_won_count,
                SUM(CASE WHEN status = 'Fechado Perdido' THEN 1 ELSE 0 END) AS total_lost_count,
                
                -- Soma dos kW das vendas ganhas
                COALESCE(SUM(CASE WHEN status = 'Fechado Ganho' THEN avg_consumption ELSE 0 END), 0) AS total_kw_won,
                
                -- Taxa de Conversão: Ganhos / (Ganhos + Perdidos) * 100
                COALESCE(
                    (SUM(CASE WHEN status = 'Fechado Ganho' THEN 1 ELSE 0 END) * 100.0) / 
                    NULLIF(SUM(CASE WHEN status IN ('Fechado Ganho', 'Fechado Perdido') THEN 1 ELSE 0 END), 0),
                    0
                ) AS conversion_rate,

                -- Taxa de Perda (Churn Rate): Perdidos / (Ganhos + Perdidos) * 100
                COALESCE(
                    (SUM(CASE WHEN status = 'Fechado Perdido' THEN 1 ELSE 0 END) * 100.0) / 
                    NULLIF(SUM(CASE WHEN status IN ('Fechado Ganho', 'Fechado Perdido') THEN 1 ELSE 0 END), 0),
                    0
                ) AS churn_rate,
                
                -- Tempo Médio de Fechamento (em dias): Diferença entre data_won e created_at
                COALESCE(
                    AVG(DATE_PART('day', date_won - created_at)) 
                    FILTER (WHERE status = 'Fechado Ganho' AND date_won IS NOT NULL),
                    0
                ) AS avg_time_to_win_days
            FROM leads 
            ${whereClause};
        `;

        const result = await pool.query(query, values);
        const data = result.rows[0];

        // Mapeia para a estrutura esperada pelo ReportsDashboard.jsx
        return {
            totalLeads: parseInt(data.total_leads_created, 10),
            activeLeads: parseInt(data.leads_active, 10),
            totalWonQty: parseInt(data.total_won_count, 10),
            totalLostQty: parseInt(data.total_lost_count, 10),
            totalKwWon: parseFloat(data.total_kw_won),
            conversionRate: parseFloat(data.conversion_rate), // Já é 0-100
            churnRate: parseFloat(data.churn_rate),       // Já é 0-100
            avgTimeToWinDays: parseFloat(data.avg_time_to_win_days),
        };
    }
    
    /**
     * Busca leads por fase para o Gráfico de Funil.
     * @param {Object} filters
     * @param {number|null} userId
     * @param {boolean} isAdmin
     */
    static async getFunnelData(filters, userId, isAdmin) {
        const { whereClause, values } = buildFilter(filters, userId, isAdmin);
        
        // Agrupa por status e calcula a soma dos kW
        const query = `
            SELECT 
                status AS stage_name, 
                COUNT(id) AS count,
                COALESCE(SUM(avg_consumption), 0) AS kw_sum
            FROM leads
            ${whereClause}
            GROUP BY status
            ORDER BY count DESC;
        `;
        
        const result = await pool.query(query, values);
        
        return result.rows.map(row => ({
            stageName: row.stage_name,
            count: parseInt(row.count, 10),
            kwSum: parseFloat(row.kw_sum)
        }));
    }

    /**
     * Busca contagem de motivos de perda.
     * @param {Object} filters
     * @param {number|null} userId
     * @param {boolean} isAdmin
     */
    static async getLostReasonsData(filters, userId, isAdmin) {
        const { whereClause, values } = buildFilter(filters, userId, isAdmin);
        
        // Filtra apenas leads perdidos e agrupa pelo motivo de perda
        const query = `
            SELECT 
                reason_for_loss AS reason, 
                COUNT(id) AS count
            FROM leads
            ${whereClause}
            AND status = 'Fechado Perdido'
            AND reason_for_loss IS NOT NULL AND reason_for_loss <> ''
            GROUP BY reason_for_loss
            ORDER BY count DESC;
        `;

        const result = await pool.query(query, values);
        
        const reasons = result.rows.map(row => ({
            reason: row.reason,
            count: parseInt(row.count, 10),
        }));
        
        const totalLost = reasons.reduce((sum, item) => sum + item.count, 0);

        return {
            reasons,
            totalLost,
        };
    }

    /**
     * Busca a atividade diária (e.g., leads criados) no período.
     * @param {Object} filters
     * @param {number|null} userId
     * @param {boolean} isAdmin
     */
    static async getDailyActivity(filters, userId, isAdmin) {
        const { whereClause, values } = buildFilter(filters, userId, isAdmin);
        
        // Agrupa por dia de criação
        const query = `
            SELECT 
                DATE(created_at) AS activity_date,
                COUNT(id) AS leads_created
            FROM leads
            ${whereClause}
            GROUP BY DATE(created_at)
            ORDER BY activity_date;
        `;
        
        const result = await pool.query(query, values);
        
        return result.rows.map(row => ({
            date: format(new Date(row.activity_date), 'dd/MM'), // Formata para o Front
            leadsCreated: parseInt(row.leads_created, 10),
        }));
    }

    /**
     * Combina todas as métricas em um único objeto de resposta.
     * @param {Object} filters
     * @param {number|null} userId
     * @param {boolean} isAdmin
     */
    static async getAllDashboardData(filters, userId, isAdmin) {
        try {
            // Executa todas as queries em paralelo para otimizar o tempo de resposta
            const [
                summaryAndProd,
                funnelData,
                lostReasons,
                dailyActivity,
            ] = await Promise.all([
                this.getSummaryAndProductivity(filters, userId, isAdmin),
                this.getFunnelData(filters, userId, isAdmin),
                this.getLostReasonsData(filters, userId, isAdmin),
                this.getDailyActivity(filters, userId, isAdmin),
            ]);

            // Monta o objeto final para o Frontend
            return {
                summary: {
                    // Mapeia para os KPIs principais
                    totalLeads: summaryAndProd.totalLeads,
                    activeLeads: summaryAndProd.activeLeads,
                    totalKwWon: summaryAndProd.totalKwWon,
                    wonLeadsQty: summaryAndProd.totalWonQty,
                    conversionRate: summaryAndProd.conversionRate,
                    churnRate: summaryAndProd.churnRate,
                    avgTimeToWinDays: summaryAndProd.avgTimeToWinDays,
                },
                productivity: {
                    // Mapeia para os dados da tabela de produtividade (usa os mesmos dados)
                    ...summaryAndProd 
                },
                funnel: funnelData,
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
            throw new Error('Falha ao gerar dados de relatório: ' + error.message);
        }
    }
    
    // Função auxiliar para exportação
    static async getLeadsForExport(filters, userId, isAdmin) {
        const { whereClause, values } = buildFilter(filters, userId, isAdmin);
        
        // CORREÇÃO: Junta com a tabela 'users' para obter o nome do proprietário
        const query = `
            SELECT 
                l.*, 
                u.name AS owner_name
            FROM leads l
            LEFT JOIN users u ON l.owner_id = u.id
            ${whereClause}
            ORDER BY l.created_at DESC;
        `;
        
        const result = await pool.query(query, values);
        return result.rows;
    }
}

module.exports = ReportDataService;