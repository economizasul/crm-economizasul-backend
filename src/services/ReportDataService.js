// src/services/ReportDataService.js

/**
 * Simulação do módulo de acesso ao banco de dados (DB).
 * Substitua estas funções pelo seu método real de consulta ao PostgreSQL (ex: Sequelize, DB pool, etc.).
 */
const db = require('../db'); // Assumindo que você tem um módulo de DB

/**
 * Calcula todas as métricas para o Dashboard de Relatórios.
 * @param {Object} filters - Filtros de período, vendedor, status e origem.
 * @param {string} userId - ID do usuário logado (para aplicar a restrição 'ownerId').
 * @param {boolean} isAdmin - Se o usuário tem permissão para ver todos os leads.
 */
class ReportDataService {

    async getDashboardMetrics(filters, userId, isAdmin) {
        // 1. Construir as condições de filtro (WHERE clause)
        const baseConditions = this._buildBaseConditions(filters, userId, isAdmin);

        // 2. Coletar dados brutos necessários
        const activeLeads = await this._getActiveLeads(baseConditions);
        const allLeads = await this._getAllLeads(baseConditions);
        const lostLeads = allLeads.filter(l => l.stage === 'Perdido');
        const wonLeads = allLeads.filter(l => l.stage === 'Ganho');

        // 3. Cálculos Principais (Métricas Individuais e Estratégicas)
        const productivityMetrics = this._calculateProductivity(activeLeads, wonLeads, filters);
        const funnelBySource = this._calculateFunnelBySource(allLeads);
        const lostReasons = this._analyzeLostReasons(lostLeads);
        const salesForecast = this._calculateForecasting(activeLeads);

        return {
            productivity: productivityMetrics,
            funnelBySource,
            lostReasons,
            salesForecast,
            // Adicionar mais dados brutos para o relatório analítico (se necessário)
        };
    }

    /**
     * Auxiliar para construir as condições de consulta SQL/ORM.
     */
    _buildBaseConditions(filters, userId, isAdmin) {
        let conditions = {};

        // 1. Restrição de Permissão (ownerId)
        if (!isAdmin) {
            conditions.ownerId = userId;
        } else if (filters.vendorId) {
            conditions.ownerId = filters.vendorId; // Se admin e filtrou por vendedor
        }
        
        // 2. Filtros de Data (createdAt)
        if (filters.periodStart && filters.periodEnd) {
            // No seu ORM, isso seria algo como: createdAt: { $gte: periodStart, $lte: periodEnd }
            conditions.createdAt = { start: filters.periodStart, end: filters.periodEnd };
        }
        
        // 3. Filtros de Origem
        if (filters.source) {
            conditions.source = filters.source;
        }

        return conditions;
    }

    /**
     * Simula a busca de leads ativos (não 'Ganho' ou 'Perdido').
     */
    async _getActiveLeads(conditions) {
        // Simulação de consulta ao DB
        // Retorna todos os Leads onde a stage NÃO é 'Ganho' e NÃO é 'Perdido', com os filtros aplicados.
        return db.Leads.find({ 
            ...conditions, 
            stage: { $nin: ['Ganho', 'Perdido'] } 
        });
    }

    /**
     * Simula a busca de todos os leads (ativos + ganhos + perdidos).
     */
    async _getAllLeads(conditions) {
         // Simulação de consulta ao DB
        return db.Leads.find(conditions); 
    }

    // --- CÁLCULO DE MÉTRICAS ---

    _calculateProductivity(activeLeads, wonLeads, filters) {
        const totalLeadsActive = activeLeads.length;
        const totalWonCount = wonLeads.length;
        const totalWonValue = wonLeads.reduce((sum, lead) => sum + lead.value, 0);

        // **Taxa de Conversão Individual (Ganho/Leads Ativos)**
        const conversionRate = totalLeadsActive > 0 ? (totalWonCount / totalLeadsActive) * 100 : 0;

        // **Tempo Médio de Fechamento**
        // Requer um campo (Ex: `timeToCloseDays`) calculado no DB ou na transição de fase.
        // Simulando um cálculo (muito simplificado):
        const totalClosingTime = wonLeads.reduce((sum, lead) => {
             // Assumindo que temos a data de entrada (createdAt) e a data de ganho (lastStageChangeAt)
             const timeDiff = new Date(lead.lastStageChangeAt).getTime() - new Date(lead.createdAt).getTime();
             return sum + timeDiff;
        }, 0);
        const avgClosingTimeMs = totalWonCount > 0 ? totalClosingTime / totalWonCount : 0;
        const avgClosingTimeDays = Math.round(avgClosingTimeMs / (1000 * 60 * 60 * 24)); // Dias

        return {
            leadsActive: totalLeadsActive,
            newLeadsInPeriod: filters.periodStart ? this._getAllLeads({ 
                createdAt: { start: filters.periodStart, end: filters.periodEnd } 
            }).length : 'N/A', // Requer nova consulta no período
            totalWonCount,
            totalWonValue,
            conversionRate: conversionRate.toFixed(2) + '%',
            avgClosingTimeDays: avgClosingTimeDays,
        };
    }

    _calculateFunnelBySource(allLeads) {
        const sourceData = {}; // Ex: { 'Google': { Novo: 10, 'Primeiro Contato': 5, ... } }
        
        allLeads.forEach(lead => {
            if (!sourceData[lead.source]) {
                sourceData[lead.source] = { total: 0 };
            }
            sourceData[lead.source].total++;
            sourceData[lead.source][lead.stage] = (sourceData[lead.source][lead.stage] || 0) + 1;
        });

        // Retorna a estrutura pronta para o gráfico de funil.
        return sourceData;
    }

    _analyzeLostReasons(lostLeads) {
        const reasons = {};
        lostLeads.forEach(lead => {
            const reason = lead.lostReason || 'Não Informado';
            reasons[reason] = (reasons[reason] || 0) + 1;
        });

        const totalLost = lostLeads.length;
        return Object.keys(reasons).map(reason => ({
            reason,
            count: reasons[reason],
            percentage: totalLost > 0 ? ((reasons[reason] / totalLost) * 100).toFixed(2) + '%' : '0.00%'
        }));
    }

    _calculateForecasting(activeLeads) {
        // Probabilidades ponderadas (Exemplo. Adapte ao seu negócio!)
        const PROBABILITIES = {
            'Novo': 10,
            'Primeiro Contato': 20,
            'Retorno Agendado': 40,
            'Em Negociação': 60,
            'Proposta Enviada': 85,
        };

        let totalPonderado = 0;
        let forecastByStage = {};

        activeLeads.forEach(lead => {
            const prob = PROBABILITIES[lead.stage] || 0;
            const ponderado = (lead.value * prob) / 100;
            
            totalPonderado += ponderado;

            if (!forecastByStage[lead.stage]) {
                forecastByStage[lead.stage] = { totalValue: 0, totalPonderado: 0, count: 0 };
            }
            forecastByStage[lead.stage].totalValue += lead.value;
            forecastByStage[lead.stage].totalPonderado += ponderado;
            forecastByStage[lead.stage].count++;
        });

        return {
            totalPonderado: totalPonderado.toFixed(2),
            details: forecastByStage
        };
    }
    
    /**
     * Busca o relatório analítico de atendimento para um Lead específico.
     * @param {string} leadId - ID do Lead.
     */
    async getAnalyticNotes(leadId) {
        // 1. Buscar dados do Lead
        const lead = await db.Leads.findOne({ id: leadId });
        if (!lead) return null;

        // 2. Buscar todas as anotações do Lead, ordenadas por data
        const notes = await db.Notes.find({ leadId: leadId }).sort({ createdAt: 1 });

        return {
            leadInfo: {
                name: lead.name,
                stage: lead.stage,
                source: lead.source,
                value: lead.value
            },
            notes: notes.map(note => ({
                type: note.type,
                content: note.content,
                createdAt: note.createdAt,
                // Você precisará buscar o nome do vendedor por note.vendorId
            }))
        };
    }
}

module.exports = new ReportDataService();