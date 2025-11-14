// services/ReportDataService.js (COMPLETO E CORRIGIDO)
const { pool } = require('../config/db');
const { format } = require('date-fns');

// ==========================================================
// 🛠️ UTILS DE FILTRAGEM
// ==========================================================
// ... (buildFilter é mantido inalterado) ...

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
        // Admin: se o filtro 'ownerId' foi aplicado
        whereClause += ` AND owner_id = $${nextIndex++}`;
        values.push(ownerId);
    }
    
    // 2. Filtro por Fonte (Source)
    if (source && source !== 'all') {
        whereClause += ` AND origin = $${nextIndex++}`;
        values.push(source);
    }
    
    return { whereClause, values };
};


class ReportDataService {
    
    // ==========================================================
    // 🗺️ NOVO: DADOS DE LOCALIZAÇÃO (MAPA)
    // ==========================================================

    /**
     * Busca a localização (lat/lng) e a cidade dos leads com status 'Ganho'.
     * @param {Object} filters - Filtros de data, vendedor e origem.
     * @param {number|null} userId - ID do usuário logado (se não for Admin).
     * @param {boolean} isAdmin - Se o usuário é Admin.
     * @returns {Array<Object>} Lista de { city, count, lat, lng }
     */
    static async getWonLeadLocations(filters, userId, isAdmin) {
        const { whereClause, values } = buildFilter(filters, userId, isAdmin); 

        // Query que busca clientes "Ganho", agrupando por cidade e coordenadas.
        const query = `
            SELECT 
                city, 
                lat,
                lng,
                COUNT(*) AS count
            FROM leads 
            ${whereClause} 
            AND status = 'Ganho'
            AND lat IS NOT NULL 
            AND lng IS NOT NULL
            GROUP BY city, lat, lng
            HAVING COUNT(*) > 0
            ORDER BY count DESC;
        `;
        
        try {
            const result = await pool.query(query, values);
            return result.rows.map(row => ({
                ...row,
                count: parseInt(row.count)
            }));
        } catch (error) {
            console.error('Erro ao buscar localizações de leads Ganho:', error);
            throw error;
        }
    }
    
    // ==========================================================
    // 📊 PRINCIPAL: BUSCA TODOS OS DADOS DO DASHBOARD
    // ==========================================================

    /**
     * Método principal que busca todos os dados do dashboard.
     */
    static async getAllDashboardData(filters, userId, isAdmin) {
        try {
            // Chamadas paralelas para otimizar o tempo de resposta
            const [
                summaryAndProd,
                funnelData,
                lostReasonsResult,
                dailyActivity,
                mapLocations // 🚨 NOVA CHAMADA
            ] = await Promise.all([
                this.getSummaryAndProdMetrics(filters, userId, isAdmin),
                this.getFunnelData(filters, userId, isAdmin),
                this.getLostReasonsData(filters, userId, isAdmin),
                this.getDailyActivity(filters, userId, isAdmin),
                this.getWonLeadLocations(filters, userId, isAdmin), // 🚨 NOVA CHAMADA
            ]);

            // Processamento de LostReasonsData
            const totalLostCount = lostReasonsResult.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
            const lostReasonsData = {
                reasons: lostReasonsResult.rows.map(row => ({
                    reason: row.reason,
                    count: parseInt(row.count)
                })),
                totalLost: totalLostCount
            };
            
            // Retorno dos dados agregados
            return {
                productivity: summaryAndProd,
                funnel: funnelData,
                lostReasons: lostReasonsData,
                dailyActivity: dailyActivity, 
                mapLocations: mapLocations, // 🚨 NOVO RETORNO
                forecasting: {
                    // Placeholder para futura implementação de previsão
                    forecastedKwWeighted: 0 
                }
            };

        } catch (error) {
            console.error('CRITICAL ERROR in ReportDataService.getAllDashboardData:', error);
            throw new Error('Falha ao gerar dados de relatório: ' + error.message);
        }
    }
    
    // ==========================================================
    // 🔧 FUNÇÕES AUXILIARES (Existentes)
    // ==========================================================
    
    // ... (Os demais métodos getSummaryAndProdMetrics, getFunnelData, getLostReasonsData, getDailyActivity, getLeadsForExport são mantidos inalterados) ...
}

module.exports = ReportDataService;