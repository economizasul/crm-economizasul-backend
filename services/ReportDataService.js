// services/ReportDataService.js
const { pool } = require('../config/db'); // Garanta que o caminho para o pool do DB está correto
const Lead = require('../models/Lead'); // Se você precisar de métodos do modelo Lead

class ReportDataService {
    
    // =============================================================
    // 🛠️ FUNÇÕES AUXILIARES PARA FILTROS
    // =============================================================

    /**
     * Constrói a cláusula WHERE e os valores do SQL baseado nos filtros e permissões.
     * @param {object} filters - Filtros como dateRange, status, ownerId, etc.
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
        if (isAdmin) {
            if (filters.ownerId && filters.ownerId !== 'all') {
                targetOwnerId = filters.ownerId;
            } else if (filters.ownerId === 'all') {
                targetOwnerId = null; // Admin pode ver todos se passar 'all'
            }
        }
        
        if (targetOwnerId !== null) {
            whereClauses.push(`l.owner_id = $${paramIndex++}`);
            queryParams.push(targetOwnerId);
        }

        // 2. FILTRO DE STATUS
        if (filters.status && filters.status !== 'all') {
            whereClauses.push(`l.status = $${paramIndex++}`);
            queryParams.push(filters.status);
        }

        // 3. FILTRO DE DATA (Assumindo um 'dateRange' com 'startDate' e 'endDate')
        if (filters.dateRange) {
            if (filters.dateRange.startDate) {
                whereClauses.push(`l.created_at >= $${paramIndex++}`);
                queryParams.push(filters.dateRange.startDate);
            }
            if (filters.dateRange.endDate) {
                whereClauses.push(`l.created_at <= $${paramIndex++}`);
                // Adiciona um dia para incluir o dia inteiro no filtro
                const endDate = new Date(filters.dateRange.endDate);
                endDate.setDate(endDate.getDate() + 1);
                queryParams.push(endDate.toISOString().split('T')[0]);
            }
        }

        return {
            whereClauses: whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '',
            queryParams: queryParams
        };
    }

    // =============================================================
    // 1. OBTENÇÃO DAS MÉTRICAS DO DASHBOARD
    // =============================================================

    /**
     * Busca e calcula as métricas do dashboard.
     */
    static async getDashboardMetrics(filters = {}, userId, isAdmin) {
        try {
            const { whereClauses, queryParams } = this.buildFilterQuery(filters, userId, isAdmin);

            // Adicionamos um UNION ou JOIN na query principal para trazer o nome do owner
            const baseQuery = `
                SELECT 
                    l.id, l.status, l.estimated_savings, l.created_at, l.updated_at,
                    u.name AS owner_name
                FROM 
                    leads l
                JOIN 
                    users u ON l.owner_id = u.id
                ${whereClauses}
            `;
            
            const result = await pool.query(baseQuery, queryParams);
            const leads = result.rows;
            
            // ==================================
            // CÁLCULO DAS MÉTRICAS
            // ==================================

            const totalLeads = leads.length;
            const leadsActive = leads.filter(l => l.status !== 'Convertido' && l.status !== 'Perdido').length;
            const totalWon = leads.filter(l => l.status === 'Convertido');
            const totalLost = leads.filter(l => l.status === 'Perdido');

            const totalWonCount = totalWon.length;
            const totalLostCount = totalLost.length;
            
            // Soma do valor de economia dos leads convertidos
            const totalWonValue = totalWon.reduce((sum, lead) => sum + (lead.estimated_savings || 0), 0);
            
            // Cálculo da Taxa de Conversão (Leads Ganhos / Total Leads)
            const conversionRate = totalLeads > 0 ? totalWonCount / totalLeads : 0;

            // Cálculo da Taxa de Perda (Leads Perdidos / Total Leads)
            const lossRate = totalLeads > 0 ? totalLostCount / totalLeads : 0;
            
            // Tempo Médio de Fechamento (somente para leads 'Convertido')
            let avgClosingTimeDays = 0;
            if (totalWonCount > 0) {
                const totalDays = totalWon.reduce((sum, lead) => {
                    const created = new Date(lead.created_at);
                    const updated = new Date(lead.updated_at);
                    const diffTime = Math.abs(updated - created);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return sum + diffDays;
                }, 0);
                avgClosingTimeDays = totalDays / totalWonCount;
            }

            return {
                productivity: {
                    totalLeads,
                    leadsActive,
                    totalWonCount,
                    totalLostCount,
                    totalWonValue,
                    conversionRate,
                    lossRate,
                    avgClosingTimeDays
                },
                // Aqui você pode adicionar mais blocos de métricas (e.g., por status, por origem)
            };

        } catch (error) {
            console.error("Erro no ReportDataService.getDashboardMetrics:", error.message);
            throw new Error('Falha ao calcular métricas do dashboard.');
        }
    }


    // =============================================================
    // 2. OBTENÇÃO DOS LEADS PARA EXPORTAÇÃO
    // =============================================================

    /**
     * Busca leads completos para exportação (CSV/PDF) com base nos filtros.
     */
    static async getLeadsForExport(filters = {}, userId, isAdmin) {
        try {
            const { whereClauses, queryParams } = this.buildFilterQuery(filters, userId, isAdmin);

            const query = `
                SELECT 
                    l.id, l.name, l.email, l.phone, l.status, l.origin, l.estimated_savings, l.created_at,
                    u.name AS owner_name
                FROM 
                    leads l
                JOIN 
                    users u ON l.owner_id = u.id
                ${whereClauses}
                ORDER BY 
                    l.created_at DESC
            `;

            const result = await pool.query(query, queryParams);
            return result.rows;

        } catch (error) {
            console.error("Erro no ReportDataService.getLeadsForExport:", error.message);
            throw new Error('Falha ao buscar leads para exportação.');
        }
    }


    // =============================================================
    // 3. OBTENÇÃO DE NOTAS ANALÍTICAS
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