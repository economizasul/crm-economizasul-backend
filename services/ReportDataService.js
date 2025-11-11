// services/ReportDataService.js
const { pool } = require('../config/db');
const Lead = require('../models/Lead');

class ReportDataService {

  /**
   * Normaliza e constrói cláusulas WHERE / params a partir dos filtros
   * Aceita tanto filtros.dateRange.{startDate,endDate} quanto filtros.startDate/filtros.endDate
   * Aceita vendorId ou ownerId e source (origem)
   */
  static buildFilterQuery(filters = {}, userId, isAdmin) {
    const whereClauses = [];
    const queryParams = [];
    let idx = 1;

    // OWNER / VENDOR
    let ownerFilter = null;
    if (filters.vendorId !== undefined) ownerFilter = filters.vendorId;
    else if (filters.ownerId !== undefined) ownerFilter = filters.ownerId;

    if (!isAdmin) {
      // Non-admin only sees own leads
      whereClauses.push(`l.owner_id = $${idx++}`);
      queryParams.push(userId);
    } else {
      // Admin: if vendorId present and !== 'all', filter; if 'all' => no owner filter
      if (ownerFilter && ownerFilter !== 'all') {
        whereClauses.push(`l.owner_id = $${idx++}`);
        queryParams.push(ownerFilter);
      }
    }

    // ORIGIN / SOURCE
    if (filters.source && filters.source !== 'all') {
      whereClauses.push(`l.origin = $${idx++}`);
      queryParams.push(filters.source);
    }

    // DATE RANGE - accept startDate/endDate or dateRange object
    let startDate = filters.startDate || (filters.dateRange && filters.dateRange.startDate);
    let endDate = filters.endDate || (filters.dateRange && filters.dateRange.endDate);

    if (startDate) {
      whereClauses.push(`l.created_at >= $${idx++}`);
      // pass ISO date (YYYY-MM-DD) to DB
      queryParams.push(startDate);
    }
    if (endDate) {
      // include full day: use <= endDate + ' 23:59:59' or add one day exclusive; here we use <= endDate + ' 23:59:59'
      const endDateTime = `${endDate} 23:59:59`;
      whereClauses.push(`l.created_at <= $${idx++}`);
      queryParams.push(endDateTime);
    }

    const where = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';
    return { where, params: queryParams };
  }

  /**
   * Retorna métricas do dashboard estruturadas para o frontend
   * - productivity: objeto com KPIs
   * - conversionBySource: array com { source, totalLeads, wonLeads, conversionRate }
   */
  static async getDashboardMetrics(filters = {}, userId, isAdmin) {
    try {
      const { where, params } = this.buildFilterQuery(filters, userId, isAdmin);

      // Seleciona campos necessários: status, owner, created/updated, origem e consumo (avg_consumption)
      const sql = `
        SELECT
          l.id,
          l.status,
          l.origin,
          l.estimated_savings,
          l.avg_consumption,
          l.created_at,
          l.updated_at,
          l.owner_id,
          u.name AS owner_name
        FROM leads l
        LEFT JOIN users u ON l.owner_id = u.id
        ${where}
      `;

      const result = await pool.query(sql, params);
      const leads = result.rows || [];

      // Normaliza status names: pelo seu frontend parece usar 'Ganho' e 'Perdido'
      const isWon = (s) => s && (s.toLowerCase() === 'ganho' || s.toLowerCase() === 'fechado' || s.toLowerCase() === 'convertido');
      const isLost = (s) => s && s.toLowerCase() === 'perdido';

      const totalLeads = leads.length;
      const totalWonArr = leads.filter(l => isWon(l.status));
      const totalLostArr = leads.filter(l => isLost(l.status));
      const leadsActiveArr = leads.filter(l => !isWon(l.status) && !isLost(l.status));

      const totalWonCount = totalWonArr.length;
      const totalLostCount = totalLostArr.length;
      const leadsActive = leadsActiveArr.length;

      // SUM of consumption (kW) for won leads (assume avg_consumption stores kW or a numeric field you want)
      const totalWonValueKW = totalWonArr.reduce((sum, l) => {
        const v = parseFloat(l.avg_consumption || 0);
        return sum + (isNaN(v) ? 0 : v);
      }, 0);

      // Conversion rate: leads won / leads that entered funnel (we'll use totalLeads that match filters)
      const conversionRate = totalLeads > 0 ? (totalWonCount / totalLeads) : 0;
      const lossRate = totalLeads > 0 ? (totalLostCount / totalLeads) : 0;

      // Average closing time (days) for won leads: difference between created_at and updated_at
      let avgClosingTimeDays = 0;
      if (totalWonCount > 0) {
        const totalDays = totalWonArr.reduce((sum, l) => {
          const created = new Date(l.created_at);
          const updated = new Date(l.updated_at || created);
          const diffMs = updated - created;
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          return sum + diffDays;
        }, 0);
        avgClosingTimeDays = totalDays / totalWonCount;
      }

      // Conversão por origem (source)
      // Group leads by origin and compute counts and conversion
      const bySource = {};
      for (const l of leads) {
        const src = l.origin || 'Desconhecida';
        if (!bySource[src]) bySource[src] = { source: src, totalLeads: 0, wonLeads: 0 };
        bySource[src].totalLeads++;
        if (isWon(l.status)) bySource[src].wonLeads++;
      }
      const conversionBySource = Object.values(bySource).map(s => ({
        source: s.source,
        totalLeads: s.totalLeads,
        wonLeads: s.wonLeads,
        conversionRate: s.totalLeads > 0 ? s.wonLeads / s.totalLeads : 0
      }));

      // Retorna o objeto esperado pelo frontend
      return {
        productivity: {
          totalLeads,
          leadsActive,
          totalWonCount,
          totalLostCount,
          totalWonValueKW,        // **kW**
          conversionRate,
          lossRate,
          avgClosingTimeDays
        },
        conversionBySource
      };

    } catch (err) {
      console.error("Erro no ReportDataService.getDashboardMetrics:", err);
      throw err;
    }
  }

  /**
   * Retorna leads completos para exportação
   */
  static async getLeadsForExport(filters = {}, userId, isAdmin) {
    try {
      const { where, params } = this.buildFilterQuery(filters, userId, isAdmin);

      const query = `
        SELECT
          l.id, l.name, l.email, l.phone, l.status, l.origin,
          l.estimated_savings, l.avg_consumption, l.created_at, u.name AS owner_name
        FROM leads l
        LEFT JOIN users u ON l.owner_id = u.id
        ${where}
        ORDER BY l.created_at DESC
      `;

      const result = await pool.query(query, params);
      return result.rows || [];
    } catch (err) {
      console.error("Erro no ReportDataService.getLeadsForExport:", err);
      throw err;
    }
  }

  /**
   * Retorna notas analíticas de um lead
   */
  static async getAnalyticNotes(leadId) {
    try {
      const lead = await Lead.findById(leadId);
      if (!lead) return null;

      let notesArray = [];
      if (lead.notes && typeof lead.notes === 'string') {
        try {
          const parsed = JSON.parse(lead.notes);
          if (Array.isArray(parsed)) notesArray = parsed.filter(n => n && n.text);
        } catch {
          notesArray = [{ text: lead.notes, timestamp: new Date(lead.updated_at).getTime(), user: 'Sistema' }];
        }
      } else if (Array.isArray(lead.notes)) {
        notesArray = lead.notes.filter(n => n && n.text);
      }

      return notesArray;
    } catch (err) {
      console.error("Erro no ReportDataService.getAnalyticNotes:", err);
      throw err;
    }
  }
}

module.exports = ReportDataService;
