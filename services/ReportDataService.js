// services/ReportDataService.js
const { pool } = require('../config/db'); // Garante que o caminho para o pool do DB está correto
const Lead = require('../models/Lead'); // Se você precisar de métodos do modelo Lead

class ReportDataService {

    // =============================================================
    // 🛠️ FUNÇÕES AUXILIARES PARA FILTROS
    // =============================================================

    /**
     * Constrói a cláusula WHERE e os valores do SQL baseado nos filtros e permissões.
     * @param {object} filters - Filtros como startDate, endDate, ownerId, etc.
     * @param {number} userId - ID do usuário logado.
     * @param {boolean} isAdmin - Se o usuário é Admin.
     * @returns {object} { whereClauses: string, queryParams: any[] }
     */
    static buildFilterQuery(filters, userId, isAdmin) {
        let whereClauses = [];
        let queryParams = [];
        let paramIndex = 1;

        // 1. FILTRO DE PROPRIETÁRIO (OWNER_ID)
        // Se for Admin e passar ownerId, filtra por ele. Caso contrário, se não for Admin, filtra pelo ID do usuário logado.
        let targetOwnerId = userId;
        // Se for Admin e o filtro 'ownerId' for 'all', não filtra por usuário (visão total).
        if (isAdmin && filters.ownerId && filters.ownerId !== 'all') {
            targetOwnerId = filters.ownerId;
        } else if (!isAdmin) {
            // Se não for Admin, força o filtro pelo seu próprio ID
            targetOwnerId = userId;
        }

        if (isAdmin && filters.ownerId === 'all') {
            // Se for Admin e explicitamente pediu 'all', não adiciona a cláusula do owner.
        } else {
            whereClauses.push(`owner_id = $${paramIndex++}`);
            queryParams.push(targetOwnerId);
        }

        // 2. FILTRO DE DATA (DATE RANGE)
        if (filters.startDate) {
            // Considera a data de criação do Lead para a filtragem por período
            whereClauses.push(`created_at >= $${paramIndex++}`);
            queryParams.push(filters.startDate);
        }
        if (filters.endDate) {
            // Adiciona 1 dia à data final para incluir o dia inteiro
            const endDate = new Date(filters.endDate);
            endDate.setDate(endDate.getDate() + 1);
            whereClauses.push(`created_at < $${paramIndex++}`);
            queryParams.push(endDate.toISOString().slice(0, 10)); // Formato YYYY-MM-DD
        }

        // 3. FILTRO DE STATUS (Se necessário, para métricas específicas que não sejam o total)
        if (filters.status && filters.status !== 'all') {
             // Este filtro não é ideal para o dashboard geral, mas pode ser útil para um drill-down
             // Mantenho a lógica para ser consistente, mas é recomendável não usá-lo na busca principal de métricas
             whereClauses.push(`status = $${paramIndex++}`);
             queryParams.push(filters.status);
        }

        // Outros filtros podem ser adicionados aqui (e.g., source, campaignId)

        return {
            whereClauses,
            queryParams
        };
    }


    // =============================================================
    // 2. OBTENÇÃO DAS MÉTRICAS DO DASHBOARD (DADOS REAIS)
    // =============================================================

    /**
     * Busca todas as métricas agregadas do pipeline de leads com base nos filtros e permissões.
     * Onde a mágica acontece.
     * @param {object} filters - Filtros.
     * @param {number} userId - ID do usuário logado.
     * @param {boolean} isAdmin - Se o usuário é Admin.
     * @returns {object} Métricas do dashboard.
     */
    static async getDashboardMetrics(filters, userId, isAdmin) {
        try {
            const { whereClauses, queryParams } = this.buildFilterQuery(filters, userId, isAdmin);
            const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

            // Consulta SQL principal para agregar todos os dados necessários.
            const query = `
                SELECT
                    status,
                    COUNT(id) AS count,
                    COALESCE(SUM(value), 0) AS value_sum,
                    -- Calcula a soma da diferença de tempo (em dias) apenas para leads 'Ganho'
                    COALESCE(SUM(CASE WHEN status = 'Ganho' THEN EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400.0 ELSE 0 END), 0) AS total_closing_time_days
                FROM
                    leads
                ${whereClause}
                GROUP BY
                    status;
            `;

            const result = await pool.query(query, queryParams);
            
            // Mapeia os resultados por status para fácil acesso
            const statusData = result.rows.reduce((acc, row) => {
                acc[row.status] = {
                    count: parseInt(row.count, 10),
                    value_sum: parseFloat(row.value_sum),
                    total_closing_time_days: parseFloat(row.total_closing_time_days),
                };
                return acc;
            }, {});

            // ===================================
            // CÁLCULO DAS MÉTRICAS
            // ===================================
            const totalWonCount = statusData['Ganho']?.count || 0;
            const totalLostCount = statusData['Perdido']?.count || 0;
            const totalWonValue = statusData['Ganho']?.value_sum || 0;

            // Total de Leads que progrediram para uma conclusão (Ganho ou Perdido)
            const totalClosedCount = totalWonCount + totalLostCount;

            // Total de Leads no período (incluindo Ativos, Ganho, Perdido)
            const totalLeads = result.rows.reduce((sum, row) => sum + parseInt(row.count, 10), 0);
            
            // Leads Ativos (Aqueles que ainda estão em andamento)
            const leadsActive = totalLeads - totalClosedCount;

            // Taxas de Conversão e Perda
            const conversionRate = totalClosedCount > 0 ? (totalWonCount / totalClosedCount) : 0;
            const lossRate = totalClosedCount > 0 ? (totalLostCount / totalClosedCount) : 0;

            // Tempo Médio de Fechamento (apenas leads 'Ganho')
            const totalClosingTimeDays = statusData['Ganho']?.total_closing_time_days || 0;
            const avgClosingTimeDays = (totalWonCount > 0) ? (totalClosingTimeDays / totalWonCount) : 0;

            // Retorna a estrutura que o ReportController e o Frontend esperam
            const metrics = {
                productivity: {
                    leadsActive,
                    totalWonCount,
                    totalWonValue,
                    totalLostCount: totalLostCount, // Adicionei para caso o Frontend precise
                    conversionRate, // 0.0 a 1.0
                    lossRate,       // 0.0 a 1.0
                    avgClosingTimeDays, // em dias
                },
                // Futuras seções (ex: Funil, Vendas por Vendedor, etc.) seriam adicionadas aqui
            };

            return metrics;

        } catch (error) {
            console.error('Erro no ReportDataService.getDashboardMetrics:', error.message);
            throw new Error('Falha ao calcular as métricas do dashboard.');
        }
    }


    // =============================================================
    // 3. OBTENÇÃO DE NOTAS ANALÍTICAS (MANTIDO)
    // =============================================================

    /**
     * Busca as notas de um lead específico.
     */
    static async getAnalyticNotes(leadId) {
        try {
            // Reutiliza o método findById do modelo Lead
            const lead = await Lead.findById(leadId);
            
            if (!lead) return null;

            // Retorna as notas no formato de array, assim como é feito no LeadController
            let notesArray = [];
            if (lead.notes && typeof lead.notes === 'string') {
                try {
                    notesArray = JSON.parse(lead.notes);
                    notesArray = Array.isArray(notesArray) ? notesArray.filter(n => n && n.text) : [];
                } catch (e) {
                    // Se não for JSON válido, trata como uma nota única
                    notesArray = [{ text: lead.notes, timestamp: new Date(lead.updated_at).getTime() }];
                }
            } else if (Array.isArray(lead.notes)) {
                notesArray = lead.notes.filter(n => n && n.text);
            }

            return notesArray;

        } catch (error) {
            console.error("Erro no ReportDataService.getAnalyticNotes:", error.message);
            throw new Error('Falha ao buscar notas analíticas.');
        }
    }

}

module.exports = ReportDataService;