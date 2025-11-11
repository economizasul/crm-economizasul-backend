// services/ReportDataService.js
const { pool } = require('../config/db');
const Lead = require('../models/Lead');

class ReportDataService {

  // ============================================================
  // 🔧 CONSTRUÇÃO DINÂMICA DO WHERE
  // ============================================================
  static buildFilterQuery(filters, userId, isAdmin) {
    let where = [];
    let params = [];
    let i = 1;

    // ✅ Filtro por vendedor
    if (isAdmin) {
      if (filters.ownerId && filters.ownerId !== 'all') {
        where.push(`l.owner_id = $${i++}`);
        params.push(filters.ownerId);
      }
      // se for "all" → não aplica filtro
    } else {
      where.push(`l.owner_id = $${i++}`);
      params.push(userId);
    }

    // ✅ Filtro por datas (somente se válidas)
    if (filters.startDate && !isNaN(new Date(filters.startDate).getTime())) {
      where.push(`l.created_at >= $${i++}`);
      params.push(filters.startDate);
    }

    if (filters.endDate && !isNaN(new Date(filters.endDate).getTime())) {
      where.push(`l.created_at <= $${i++}`);
      params.push(filters.endDate);
    }

    // ✅ Filtro por origem
    if (filters.source && filters.source !== 'all') {
      where.push(`l.origin = $${i++}`);
      params.push(filters.source);
    }

    const whereSQL = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
    return { whereSQL, params };
  }

  // ============================================================
  // 📊 DASHBOARD MÉTRICAS PRINCIPAIS
  // ============================================================
  static async getDashboardMetrics(filters = {}, userId, isAdmin) {
    const { whereSQL, params } = this.buildFilterQuery(filters, userId, isAdmin);

    const query = `
      SELECT 
        l.id, 
        l.status, 
        COALESCE(l.avg_consumption, 0) AS avg_consumption,
        l.created_at, 
        l.updated_at,
        u.name AS owner_name
      FROM leads l
      JOIN users u ON u.id = l.owner_id
      ${whereSQL}
    `;

    const result = await pool.query(query, params);
    const leads = result.rows || [];

    // ============================================================
    // 🧮 Cálculos de métricas
    // ============================================================

    const totalLeads = leads.length;

    // ✅ Normaliza o status para comparação insensível a maiúsculas/acentos
    const normalize = (s) =>
      (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

    const leadsActive = leads.filter(l => {
      const st = normalize(l.status);
      return [
        'novo',
        'em atendimento',
        'negociacao',
        'proposta',
        'ativo',
        'em andamento'
      ].includes(st);
    }).length;

    const totalWon = leads.filter(l => {
      const st = normalize(l.status);
      return ['fechado ganho', 'ganho', 'convertido'].includes(st);
    });

    const totalLost = leads.filter(l => {
      const st = normalize(l.status);
      return ['perdido', 'fechado perdido'].includes(st);
    });

    const totalWonCount = totalWon.length;
    const totalLostCount = totalLost.length;

    // ✅ Soma total de consumo (kW)
    const totalWonValueKW = totalWon.reduce((sum, l) => sum + (l.avg_consumption || 0), 0);

    // ✅ Taxas
    const conversionRate = totalLeads > 0 ? totalWonCount / totalLeads : 0;
    const lossRate = totalLeads > 0 ? totalLostCount / totalLeads : 0;

    // ✅ Tempo médio de fechamento
    let avgClosingTimeDays = 0;
    if (totalWonCount > 0) {
      const totalDays = totalWon.reduce((sum, l) => {
        const created = new Date(l.created_at);
        const updated = new Date(l.updated_at);
        const diffDays = Math.max(0, Math.ceil((updated - created) / (1000 * 60 * 60 * 24)));
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
        totalWonValueKW, // ⚡ nome padronizado pro frontend
        conversionRate,
        lossRate,
        avgClosingTimeDays
      }
    };
  }

  // ============================================================
  // 📦 EXPORTAÇÃO DE LEADS
  // ============================================================
  static async getLeadsForExport(filters = {}, userId, isAdmin) {
    const { whereSQL, params } = this.buildFilterQuery(filters, userId, isAdmin);
    const query = `
      SELECT 
        l.id, 
        l.name, 
        l.phone, 
        l.email, 
        l.status, 
        l.origin, 
        l.avg_consumption, 
        l.created_at, 
        u.name AS owner_name
      FROM leads l
      JOIN users u ON u.id = l.owner_id
      ${whereSQL}
      ORDER BY l.created_at DESC
    `;
    const result = await pool.query(query, params);
    return result.rows || [];
  }

  // ============================================================
  // 🗒️ NOTAS ANALÍTICAS
  // ============================================================
  static async getAnalyticNotes(leadId) {
    const lead = await Lead.findById(leadId);
    if (!lead) return null;

    try {
      const parsed = JSON.parse(lead.notes || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

module.exports = ReportDataService;
