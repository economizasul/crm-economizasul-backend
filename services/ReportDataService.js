// services/ReportDataService.js
const { pool } = require('../config/db');
const Lead = require('../models/Lead');

class ReportDataService {
  static buildFilterQuery(filters = {}, userId, isAdmin) {
    const where = [];
    const params = [];
    let i = 1;

    // owner filter: aceita filters.ownerId ou filters.vendorId (frontend)
    const ownerRaw = filters.ownerId ?? filters.vendorId ?? filters.owner ?? null;
    const ownerId = ownerRaw && ownerRaw !== 'all' ? parseInt(ownerRaw, 10) : null;

    if (isAdmin) {
      if (ownerId) {
        where.push(`l.owner_id = $${i++}`);
        params.push(ownerId);
      }
    } else {
      where.push(`l.owner_id = $${i++}`);
      params.push(userId);
    }

    if (filters.startDate && !isNaN(new Date(filters.startDate).getTime())) {
      // use ISO string (date-only) - compares >= start
      const startISO = new Date(filters.startDate).toISOString();
      where.push(`l.created_at >= $${i++}`);
      params.push(startISO);
    }

    if (filters.endDate && !isNaN(new Date(filters.endDate).getTime())) {
      // make endDate inclusive by adding 1 day and comparing <
      const end = new Date(filters.endDate);
      end.setDate(end.getDate() + 1);
      where.push(`l.created_at < $${i++}`);
      params.push(end.toISOString());
    }

    if (filters.source && filters.source !== 'all') {
      where.push(`l.origin = $${i++}`);
      params.push(filters.source);
    }

    const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';
    return { whereSQL, params };
  }

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

    const totalLeads = leads.length;

    const normalize = (s) =>
      (s || '')
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    const activeSet = new Set(['novo', 'em atendimento', 'negociacao', 'proposta', 'ativo', 'em andamento']);
    const wonSet = new Set(['fechado ganho', 'ganho', 'convertido']);
    const lostSet = new Set(['perdido', 'fechado perdido']);

    const leadsActive = leads.filter(l => activeSet.has(normalize(l.status))).length;
    const totalWon = leads.filter(l => wonSet.has(normalize(l.status)));
    const totalLost = leads.filter(l => lostSet.has(normalize(l.status)));

    const totalWonCount = totalWon.length;
    const totalLostCount = totalLost.length;

    const totalWonValueKW = totalWon.reduce((sum, l) => sum + (Number(l.avg_consumption) || 0), 0);

    const conversionRate = totalLeads > 0 ? totalWonCount / totalLeads : 0;
    const lossRate = totalLeads > 0 ? totalLostCount / totalLeads : 0;

    let avgClosingTimeDays = 0;
    if (totalWonCount > 0) {
      const totalDays = totalWon.reduce((sum, l) => {
        const created = new Date(l.created_at);
        const updated = new Date(l.updated_at);
        const diff = Math.max(0, Math.ceil((updated - created) / (1000 * 60 * 60 * 24)));
        return sum + diff;
      }, 0);
      avgClosingTimeDays = totalDays / totalWonCount;
    }

    return {
      productivity: {
        totalLeads,
        leadsActive,
        totalWonCount,
        totalLostCount,
        totalWonValueKW,
        conversionRate,
        lossRate,
        avgClosingTimeDays
      }
    };
  }

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
