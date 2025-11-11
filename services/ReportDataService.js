// services/ReportDataService.js
const { pool } = require('../config/db');
const Lead = require('../models/Lead');

class ReportDataService {

  static buildFilterQuery(filters, userId, isAdmin) {
    let whereClauses = [];
    let queryParams = [];
    let paramIndex = 1;

    let targetOwnerId = userId;
    if (isAdmin) {
      if (filters.ownerId && filters.ownerId !== 'all') targetOwnerId = filters.ownerId;
      else if (filters.ownerId === 'all') targetOwnerId = null;
    }

    if (targetOwnerId !== null) {
      whereClauses.push(`l.owner_id = $${paramIndex++}`);
      queryParams.push(targetOwnerId);
    }

    if (filters.status && filters.status !== 'all') {
      whereClauses.push(`l.status = $${paramIndex++}`);
      queryParams.push(filters.status);
    }

    if (filters.startDate) {
      whereClauses.push(`l.created_at >= $${paramIndex++}`);
      queryParams.push(filters.startDate);
    }

    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setDate(end.getDate() + 1);
      whereClauses.push(`l.created_at < $${paramIndex++}`);
      queryParams.push(end.toISOString().split('T')[0]);
    }

    return {
      whereClauses: whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '',
      queryParams
    };
  }

  static async getDashboardMetrics(filters = {}, userId, isAdmin) {
    const { whereClauses, queryParams } = this.buildFilterQuery(filters, userId, isAdmin);

    const query = `
      SELECT 
        l.id, l.status, l.estimated_savings, l.created_at, l.updated_at,
        u.name AS owner_name
      FROM leads l
      JOIN users u ON l.owner_id = u.id
      ${whereClauses}
    `;

    const result = await pool.query(query, queryParams);
    const leads = result.rows;

    const totalLeads = leads.length;
    const leadsActive = leads.filter(l => !['Convertido', 'Perdido'].includes(l.status)).length;
    const totalWon = leads.filter(l => l.status === 'Convertido');
    const totalLost = leads.filter(l => l.status === 'Perdido');

    const totalWonValue = totalWon.reduce((sum, l) => sum + (l.estimated_savings || 0), 0);
    const totalWonCount = totalWon.length;
    const totalLostCount = totalLost.length;

    const conversionRate = totalLeads > 0 ? totalWonCount / totalLeads : 0;
    const lossRate = totalLeads > 0 ? totalLostCount / totalLeads : 0;

    let avgClosingTimeDays = 0;
    if (totalWonCount > 0) {
      const totalDays = totalWon.reduce((sum, l) => {
        const created = new Date(l.created_at);
        const updated = new Date(l.updated_at);
        return sum + Math.ceil((updated - created) / (1000 * 60 * 60 * 24));
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

  static async getLeadsForExport(filters = {}, userId, isAdmin) {
    const { whereClauses, queryParams } = this.buildFilterQuery(filters, userId, isAdmin);
    const query = `
      SELECT 
        l.id, l.name, l.email, l.phone, l.status, l.origin, l.estimated_savings, l.created_at,
        u.name AS owner_name
      FROM leads l
      JOIN users u ON l.owner_id = u.id
      ${whereClauses}
      ORDER BY l.created_at DESC
    `;
    const result = await pool.query(query, queryParams);
    return result.rows;
  }

  static async getAnalyticNotes(leadId) {
    const lead = await Lead.findById(leadId);
    if (!lead) return null;

    let notesArray = [];
    try {
      notesArray = Array.isArray(JSON.parse(lead.notes))
        ? JSON.parse(lead.notes).filter(n => n && n.text)
        : [];
    } catch {
      notesArray = [{ text: lead.notes, timestamp: new Date(lead.updated_at).getTime() }];
    }

    return notesArray;
  }
}

module.exports = ReportDataService;
