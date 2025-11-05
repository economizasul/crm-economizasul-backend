// services/ReportDataService.js

// Importa a conexão com o DB e o modelo de Lead, usando o caminho correto a partir de services/
const { pool } = require('../config/db'); 
const Lead = require('../models/Lead'); 

class ReportDataService {

    /**
     * Aplica filtros (data, proprietário, etc.) e permissões de usuário à query SQL.
     * @param {Object} filters - Objeto de filtros (startDate, endDate, ownerId).
     * @param {number} userId - ID do usuário logado.
     * @param {boolean} isAdmin - Se o usuário é Admin e pode ver todos os dados.
     * @returns {Object} { whereClause, queryParams }
     */
    static buildFilterClause(filters, userId, isAdmin) {
        let whereClause = 'WHERE 1=1'; // Cláusula base
        const queryParams = [];
        let paramIndex = 1;

        // 1. Filtragem por Permissão
        if (!isAdmin) {
            // Se não for Admin, restringe a leads do próprio usuário (owner_id)
            whereClause += ` AND owner_id = $${paramIndex++}`;
            queryParams.push(userId);
        } else if (filters.ownerId) {
            // Se for Admin e o filtro ownerId for fornecido
            whereClause += ` AND owner_id = $${paramIndex++}`;
            queryParams.push(filters.ownerId);
        }

        // 2. Filtragem por Data (created_at)
        if (filters.startDate) {
            whereClause += ` AND created_at >= $${paramIndex++}`;
            queryParams.push(filters.startDate);
        }
        if (filters.endDate) {
            // Adiciona um dia para incluir a data final no filtro (meia-noite do dia seguinte)
            const endDate = new Date(filters.endDate);
            endDate.setDate(endDate.getDate() + 1);
            whereClause += ` AND created_at < $${paramIndex++}`;
            queryParams.push(endDate.toISOString().split('T')[0]);
        }

        return { whereClause, queryParams };
    }

    /**
     * @desc Calcula todas as métricas para o dashboard de relatórios.
     */
    static async getDashboardMetrics(filters = {}, userId, isAdmin) {
        const { whereClause, queryParams } = this.buildFilterClause(filters, userId, isAdmin);

        try {
            // 1. Métricas de Produtividade/Funil
            const productivityQuery = `
                SELECT
                    COUNT(id) AS total_leads_count,
                    COUNT(CASE WHEN status = 'Convertido' THEN 1 END) AS total_won_count,
                    COALESCE(SUM(CASE WHEN status = 'Convertido' THEN estimated_savings ELSE 0 END), 0) AS total_won_value,
                    COUNT(CASE WHEN status = 'Perdido' THEN 1 END) AS total_lost_count,
                    -- Calcula o tempo médio de fechamento (apenas leads convertidos)
                    COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) / 86400, 0) AS avg_closing_time_seconds 
                FROM leads
                ${whereClause};
            `;
            const productivityResult = await pool.query(productivityQuery, queryParams);
            const prod = productivityResult.rows[0];

            const totalLeads = parseInt(prod.total_leads_count, 10);
            const totalWon = parseInt(prod.total_won_count, 10);
            const totalLost = parseInt(prod.total_lost_count, 10);
            
            // Tratamento para evitar divisão por zero
            const totalFechados = totalWon + totalLost;
            const conversionRate = totalFechados > 0 ? totalWon / totalFechados : 0;
            const lossRate = totalFechados > 0 ? totalLost / totalFechados : 0;
            const avgClosingTimeDays = parseFloat(prod.avg_closing_time_seconds) || 0;


            // 2. Leads Ativos (Status diferente de 'Convertido' e 'Perdido')
            const activeLeadsQuery = `
                SELECT COUNT(id) AS leads_active
                FROM leads
                ${whereClause} AND status NOT IN ('Convertido', 'Perdido');
            `;
            const activeLeadsResult = await pool.query(activeLeadsQuery, queryParams);
            const leadsActive = parseInt(activeLeadsResult.rows[0].leads_active, 10);
            
            // 3. Distribuição de Leads por Status
            const statusDistributionQuery = `
                SELECT status, COUNT(id) AS count
                FROM leads
                ${whereClause}
                GROUP BY status
                ORDER BY count DESC;
            `;
            const statusDistributionResult = await pool.query(statusDistributionQuery, queryParams);
            const statusDistribution = statusDistributionResult.rows.map(row => ({
                status: row.status,
                count: parseInt(row.count, 10)
            }));
            
            // 4. Distribuição de Leads por Origem
            const originDistributionQuery = `
                SELECT origin, COUNT(id) AS count
                FROM leads
                ${whereClause}
                GROUP BY origin
                ORDER BY count DESC;
            `;
            const originDistributionResult = await pool.query(originDistributionQuery, queryParams);
            const originDistribution = originDistributionResult.rows.map(row => ({
                origin: row.origin,
                count: parseInt(row.count, 10)
            }));
            

            return {
                productivity: {
                    totalLeadsCount: totalLeads,
                    leadsActive,
                    totalWonCount: totalWon,
                    totalWonValue: parseFloat(prod.total_won_value),
                    totalLostCount: totalLost,
                    conversionRate,
                    lossRate,
                    avgClosingTimeDays
                },
                statusDistribution,
                originDistribution
            };

        } catch (error) {
            console.error('Erro ao calcular métricas do dashboard:', error.message);
            throw new Error('Falha ao acessar o banco de dados para métricas.');
        }
    }

    /**
     * @desc Obtém a lista de leads com nome do proprietário para exportação CSV/XLSX.
     */
    static async getLeadsForExport(filters = {}, userId, isAdmin) {
         const { whereClause, queryParams } = this.buildFilterClause(filters, userId, isAdmin);

         try {
             const exportQuery = `
                 SELECT 
                     l.id, 
                     l.name, 
                     l.phone, 
                     l.email, 
                     l.status, 
                     l.origin, 
                     u.name AS owner_name, 
                     l.created_at, 
                     l.estimated_savings
                 FROM leads l
                 JOIN users u ON l.owner_id = u.id
                 ${whereClause}
                 ORDER BY l.created_at DESC;
             `;
             
             const result = await pool.query(exportQuery, queryParams);
             return result.rows;
         } catch (error) {
             console.error('Erro ao buscar leads para exportação:', error.message);
             throw new Error('Falha ao buscar dados para exportação.');
         }
    }

    /**
     * @desc Obtém as notas de um lead específico.
     */
    static async getAnalyticNotes(leadId) {
        try {
            const result = await pool.query('SELECT notes, updated_at FROM leads WHERE id = $1', [leadId]);
            const lead = result.rows[0];

            if (!lead) return null;

            // Replicando a lógica de formatação de notas do leadController para garantir consistência
            let notesArray = [];
            if (lead.notes && typeof lead.notes === 'string') {
                try {
                    const parsedNotes = JSON.parse(lead.notes);
                    if (Array.isArray(parsedNotes)) {
                        notesArray = parsedNotes.filter(note => note && note.text); 
                    } else {
                        // Caso a string seja texto puro e não JSON de array
                        notesArray = [{ text: lead.notes, timestamp: new Date(lead.updated_at).getTime() }];
                    }
                } catch (e) {
                    console.warn(`Aviso: Falha ao fazer JSON.parse na nota do Lead ID ${leadId}. Salvando como nota única.`);
                    notesArray = [{ text: lead.notes, timestamp: new Date(lead.updated_at).getTime() }];
                }
            } else if (Array.isArray(lead.notes)) {
                notesArray = lead.notes.filter(note => note && note.text);
            }
            
            return notesArray;

        } catch (error) {
            console.error(`Erro ao buscar notas do lead ID ${leadId}:`, error.message);
            throw new Error('Falha ao buscar notas analíticas.');
        }
    }
}

module.exports = ReportDataService;