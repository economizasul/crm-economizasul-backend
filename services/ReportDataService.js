// services/ReportDataService.js
const { pool } = require('../config/db');
const Lead = require('../models/Lead');

class ReportDataService {

  static buildFilterQuery(filters, userId, isAdmin) {
    let where = [];
    let params = [];
    let i = 1;

    // Filtro por vendedor
    if (isAdmin) {
      if (filters.ownerId && filters.ownerId !== 'all') {
        where.push(`l.owner_id = $${i++}`);
        params.push(filters.ownerId);
      }
    } else {
      where.push(`l.owner_id = $${i++}`);
      params.push(userId);
    }

    // Filtro por datas
    if (filters.startDate) {
      where.push(`l.created_at >= $${i++}`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setDate(end.getDate() + 1);
      where.push(`l.created_at < $${i++}`);
      params.push(end.toISOString().split('T')[0]);
    }

    // Filtro por origem
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
        l.id, l.status, l.avg_consumption, l.created_at, l.updated_at, 
        u.name AS owner_name
      FROM leads l
      JOIN users u ON u.id = l.owner_id
      ${whereSQL}
    `;

    const result = await pool.query(query, params);
    const leads = result.rows;

    // ============================================================
    // 🧮 Cálculos de métricas
    // ============================================================
    const totalLeads = leads.length;

    // Consideramos como "ativos" tudo que não está Fechado/Ganho ou Perdido
    const activeStatuses = [
      'Novo',
      'Em Atendimento',
      'Negociação',
      'Proposta',
      'Ativo',
      'Em andamento'
    ];

    const leadsActive = leads.filter(l => activeStatuses.includes(l.status)).length;
    const totalWon = leads.filter(l => ['Fechado Ganho', 'Ganho', 'Convertido'].includes(l.status));
    const totalLost = leads.filter(l => ['Perdido', 'Fechado Perdido'].includes(l.status));

    const totalWonCount = totalWon.length;
    const totalLostCount = totalLost.length;

    // ✅ Agora soma o campo avg_consumption (em KW)
    const totalWonValue = totalWon.reduce((sum, l) => sum + (l.avg_consumption || 0), 0);

    const conversionRate = totalLeads > 0 ? totalWonCount / totalLeads : 0;
    const lossRate = totalLeads > 0 ? totalLostCount / totalLeads : 0;

    let avgClosingTimeDays = 0;
    if (totalWonCount > 0) {
      const totalDays = totalWon.reduce((sum, l) => {
        const created = new Date(l.created_at);
        const updated = new Date(l.updated_at);
        const diffDays = Math.ceil((updated - created) / (1000 * 60 * 60 * 24));
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
        l.id, l.name, l.phone, l.email, l.status, l.origin, 
        l.avg_consumption, l.created_at, u.name AS owner_name
      FROM leads l
      JOIN users u ON u.id = l.owner_id
      ${whereSQL}
      ORDER BY l.created_at DESC
    `;
    const result = await pool.query(query, params);
    return result.rows;
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
