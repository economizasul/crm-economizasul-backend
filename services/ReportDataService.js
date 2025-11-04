// services/ReportDataService.js
const { pool } = require('../db');

class ReportDataService {
  _buildBaseConditions(filters, userId, isAdmin) {
    let whereClause = 'WHERE l.is_active = TRUE AND l.created_at IS NOT NULL';
    const values = [];
    let index = 1;

    if (!isAdmin) {
      whereClause += ` AND l.owner_id = $${index++}`;
      values.push(userId);
    }

    if (filters.startDate) {
      whereClause += ` AND l.created_at >= $${index++}`;
      values.push(filters.startDate);
    }

    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setDate(end.getDate() + 1);
      whereClause += ` AND l.created_at < $${index++}`;
      values.push(end.toISOString().split('T')[0]);
    }

    if (filters.vendorId && filters.vendorId !== 'all' && (isAdmin || filters.vendorId !== userId)) {
      whereClause += ` AND l.owner_id = $${index++}`;
      values.push(filters.vendorId);
    }

    if (filters.source && filters.source !== 'all') {
      whereClause += ` AND l.origin = $${index++}`;
      values.push(filters.source);
    }

    return { whereClause, values };
  }

  async getLeadsForExport(filters, userId, isAdmin) {
    const { whereClause, values } = this._buildBaseConditions(filters, userId, isAdmin);
    const query = `
      SELECT l.*, u.name AS owner_name
      FROM leads l
      LEFT JOIN users u ON l.owner_id = u.id
      ${whereClause}
      ORDER BY l.created_at DESC
    `;
    const { rows } = await pool.query(query, values);
    return rows;
  }

  async getFunnelStages(filters, userId, isAdmin) {
    const { whereClause, values } = this._buildBaseConditions(filters, userId, isAdmin);
    const query = `
      SELECT status, COUNT(*) AS count
      FROM leads l
      ${whereClause}
      GROUP BY status
      ORDER BY CASE status
        WHEN 'Novo' THEN 1
        WHEN 'Contato Inicial' THEN 2
        WHEN 'Qualificado' THEN 3
        WHEN 'Proposta Enviada' THEN 4
        WHEN 'Em Negociação' THEN 5
        WHEN 'Ganho' THEN 6
        WHEN 'Perdido' THEN 7
        ELSE 99
      END
    `;
    const { rows } = await pool.query(query, values);
    return rows;
  }

  async getLostReasonsAnalysis(filters, userId, isAdmin) {
    const { whereClause, values } = this._buildBaseConditions(filters, userId, isAdmin);
    const query = `
      SELECT reason_for_loss AS reason, COUNT(*) AS count
      FROM leads l
      ${whereClause}
      AND status = 'Perdido' AND reason_for_loss IS NOT NULL
      GROUP BY reason_for_loss
      ORDER BY count DESC
    `;
    const { rows } = await pool.query(query, values);
    return { reasons: rows };
  }

  async getDashboardMetrics(filters, userId, isAdmin) {
    const { whereClause, values } = this._buildBaseConditions(filters, userId, isAdmin);

    const query = `
      WITH base AS (SELECT COUNT(*) AS total FROM leads l ${whereClause}),
      active AS (
        SELECT 
          COUNT(*) AS active,
          COALESCE(SUM(estimated_savings), 0) AS pipeline,
          COALESCE(SUM(CASE
            WHEN status = 'Novo' THEN estimated_savings * 0.1
            WHEN status = 'Contato Inicial' THEN estimated_savings * 0.3
            WHEN status = 'Qualificado' THEN estimated_savings * 0.5
            WHEN status = 'Proposta Enviada' THEN estimated_savings * 0.7
            WHEN status = 'Em Negociação' THEN estimated_savings * 0.9
            ELSE 0
          END), 0) AS weighted
        FROM leads l ${whereClause} AND status NOT IN ('Ganho', 'Perdido')
      ),
      won AS (
        SELECT 
          COUNT(*) AS won_count,
          COALESCE(SUM(estimated_savings), 0) AS won_value,
          COALESCE(AVG(EXTRACT(DAY FROM (date_won - created_at))) FILTER (WHERE date_won IS NOT NULL), 0) AS avg_days
        FROM leads l ${whereClause} AND status = 'Ganho'
      ),
      lost AS (SELECT COUNT(*) AS lost_count FROM leads l ${whereClause} AND status = 'Perdido')
      SELECT 
        (SELECT total FROM base) AS total,
        (SELECT active FROM active) AS active,
        (SELECT pipeline FROM active) AS pipeline,
        (SELECT weighted FROM active) AS weighted,
        (SELECT won_count FROM won) AS won_count,
        (SELECT won_value FROM won) AS won_value,
        (SELECT avg_days FROM won) AS avg_days,
        (SELECT lost_count FROM lost) AS lost_count
    `;

    const { rows } = await pool.query(query, values);
    const r = rows[0];

    const total = Number(r.total) || 0;
    const lostAnalysis = await this.getLostReasonsAnalysis(filters, userId, isAdmin);
    const funnel = await this.getFunnelStages(filters, userId, isAdmin);

    return {
      productivity: {
        leadsActive: Number(r.active) || 0,
        totalWonCount: Number(r.won_count) || 0,
        totalWonValue: Number(r.won_value) || 0,
        avgClosingTimeDays: Number(r.avg_days) || 0,
        lossRate: total > 0 ? Number(r.lost_count) / total : 0,
        conversionRate: total > 0 ? Number(r.won_count) / total : 0
      },
      salesForecast: {
        weightedValue: Number(r.weighted) || 0,
        totalValue: Number(r.pipeline) || 0
      },
      funnelStages: funnel,
      lostLeadsAnalysis: lostAnalysis
    };
  }

  async getAnalyticNotes(leadId) {
    const leadQuery = `
      SELECT l.id, l.name, l.status AS stage, l.estimated_savings AS value, l.origin AS source,
             l.owner_id AS "ownerId", u.name AS "ownerName"
      FROM leads l
      JOIN users u ON u.id = l.owner_id
      WHERE l.id = $1
    `;

    const notesQuery = `
      SELECT n.id, n.content, n.type, n.created_at AS "createdAt", u.name AS "vendorName"
      FROM lead_notes n
      JOIN users u ON u.id = n.user_id
      WHERE n.lead_id = $1
      ORDER BY n.created_at DESC
    `;

    const [leadRes, notesRes] = await Promise.all([
      pool.query(leadQuery, [leadId]),
      pool.query(notesQuery, [leadId])
    ]);

    if (leadRes.rows.length === 0) return null;

    return {
      leadInfo: leadRes.rows[0],
      notes: notesRes.rows
    };
  }
}

module.exports = new ReportDataService();