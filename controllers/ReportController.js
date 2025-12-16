// controllers/ReportController.js
const { pool } = require('../config/db');
const ReportDataService = require('../services/ReportDataService');
const CsvGeneratorService = require('../services/CsvGeneratorService');
const PdfGeneratorService = require('../services/PdfGeneratorService');

class ReportController {
  constructor() {
    this.getVendors = ReportController.getVendors.bind(this);
    this.getReportData = ReportController.getReportData.bind(this);
    this.getAnalyticNotes = ReportController.getAnalyticNotes.bind(this);
    this.exportCsv = ReportController.exportCsv.bind(this);
    this.exportPdf = ReportController.exportPdf.bind(this);
    this.getLeadsGanhoParaMapa = ReportController.getLeadsGanhoParaMapa.bind(this);
  }

  static async getVendors(req, res) {
    try {
      const isAdmin = req.user?.role === 'Admin';
      const query = isAdmin
        ? `SELECT id, name, email, role FROM users ORDER BY name;`
        : `SELECT id, name, email, role FROM users WHERE id = $1 ORDER BY name;`;
      const values = isAdmin ? [] : [req.user.id];
      const result = await pool.query(query, values);
      return res.status(200).json({ success: true, data: result.rows || [] });
    } catch (error) {
      console.error('Erro ao buscar vendedores:', error);
      return res.status(500).json({ success: false, message: 'Erro ao buscar vendedores.' });
    }
  }

  static async getReportData(req, res) {
    try {
      // === FILTROS (mantido igual) ===
      let filters = {};
      if (req.body) {
        if (req.body.filters && typeof req.body.filters === 'object') {
          filters = req.body.filters;
        } else {
          const bodyKeys = Object.keys(req.body || {});
          const likelyFilterKeys = ['startDate', 'endDate', 'vendedor', 'ownerId', 'source', 'start_date', 'end_date'];
          const hasFilterKey = bodyKeys.some(k => likelyFilterKeys.includes(k));
          filters = hasFilterKey ? req.body : (req.body.filters || {});
        }
      }

      if ((!filters || Object.keys(filters).length === 0) && req.query && req.query.filters) {
        try {
          filters = typeof req.query.filters === 'string' ? JSON.parse(req.query.filters) : req.query.filters;
        } catch (e) {
          filters = {};
        }
      }

      const userId = req.user?.id || null;
      const isAdmin = req.user?.role === 'Admin' || false;

      const data = await ReportDataService.getAllDashboardData(filters, userId, isAdmin);
      return res.status(200).json({ success: true, data });

    } catch (error) {
      // LOG COMPLETO — AGORA 100% CORRETO
      console.error("===== ERRO CRÍTICO NO /api/v1/reports/data =====");
      console.error("Horário:", new Date().toISOString());
      console.error("Usuário:", req.user?.id, req.user?.name, "Admin:", req.user?.role === 'Admin');
      console.error("Filtros:", JSON.stringify(req.body, null, 2));
      console.error("Erro completo:", error);
      if (error.message) console.error("Message:", error.message);
      if (error.code) console.error("Code:", error.code);
      if (error.detail) console.error("Detail:", error.detail);
      if (error.hint) console.error("Hint:", error.hint);
      if (error.position) console.error("Position:", error.position);
      if (error.stack) console.error("Stack:", error.stack);

      return res.status(500).json({
        success: false,
        message: "Erro interno no relatório (debug ativo)",
        debug: {
          code: error.code || "unknown",
          message: error.message || "sem mensagem",
          detail: error.detail || null,
          hint: error.hint || null
        }
      });
    }
  }

  static async getAnalyticNotes(req, res) {
    return res.status(200).json({ success: true, data: [] });
  }

  static async exportCsv(req, res) {
    try {
      let filters = req.body.filters || req.query.filters || {};
      if (typeof filters === 'string') filters = JSON.parse(filters);

      const userId = req.user?.id || null;
      const isAdmin = req.user?.role === 'Admin' || false;

      const leadsForExport = await ReportDataService.getLeadsForExport(filters, userId, isAdmin);
      const csvString = await CsvGeneratorService.exportLeads(leadsForExport);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=relatorio_leads_${new Date().toISOString().slice(0, 10)}.csv`);
      return res.status(200).send('\ufeff' + csvString);
    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
      return res.status(500).json({ success: false, message: 'Erro interno ao gerar CSV.' });
    }
  }

  static async exportPdf(req, res) {
    try {
      let filters = req.body.filters || req.query.filters || {};
      if (typeof filters === 'string') filters = JSON.parse(filters);

      const userId = req.user?.id || null;
      const isAdmin = req.user?.role === 'Admin' || false;

      const metrics = await ReportDataService.getAllDashboardData(filters, userId, isAdmin);
      const leadsForPdf = await ReportDataService.getLeadsForExport(filters, userId, isAdmin);

      const pdfBuffer = await PdfGeneratorService.generateFullReportPdf({
        metrics,
        leads: leadsForPdf,
        filters: filters,
        generatorName: req.user?.name || 'Sistema',
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=relatorio_completo_${new Date().toISOString().slice(0, 10)}.pdf`);
      return res.status(200).send(pdfBuffer);
    } catch (error) {
      console.error('Erro ao exportar PDF (ReportController):', error.message || error);
      return res.status(500).json({
        success: false,
        message: 'Falha crítica ao gerar PDF.'
      });
    }
  }

  // NOVO ENDPOINT PARA O MAPA INTERATIVO
  static async getLeadsGanhoParaMapa(req, res) {
    try {
      let filters = req.body.filters || {};
      if (typeof filters === 'string') {
        try { filters = JSON.parse(filters); } catch (e) { filters = {}; }
      }

      const userId = req.user?.id;
      const isAdmin = req.user?.role === 'Admin';

      let query = `
        SELECT 
          l.id,
          l.name,
          l.cidade,
          l.regiao,
          l.google_maps_link,
          l.lat,
          l.lng,
          l.created_at,
          l.updated_at,
          l.seller_id,
          u.name as seller_name
        FROM leads l
        LEFT JOIN users u ON u.id = l.owner_id
        WHERE l.status = 'Ganho'
          AND l.google_maps_link IS NOT NULL 
          AND l.google_maps_link <> ''
      `;

      const conditions = [];
      const values = [];

      // Filtro de data (se vier do dashboard)
      if (filters.startDate && filters.endDate) {
        conditions.push(`l.date_won BETWEEN $${values.length + 1} AND $${values.length + 2}`);
        values.push(filters.startDate, filters.endDate);
      }

      // Filtro de vendedor (se o admin selecionar um)
      if (filters.vendedor && filters.vendedor !== 'todos') {
        conditions.push(`l.seller_id = $${values.length + 1}::text`);
        values.push(filters.vendedor);
      }

      // Restrição para usuário comum (só vê os próprios leads)
      if (!isAdmin) {
        conditions.push(`l.owner_id = $${values.length + 1}`);
        values.push(userId);
      }

      if (conditions.length > 0) {
        query += ' AND ' + conditions.join(' AND ');
      }

      query += ' ORDER BY l.created_at DESC';

      const result = await pool.query(query, values);

      return res.status(200).json({
        success: true,
        data: result.rows || []
      });

    } catch (error) {
      console.error('Erro no endpoint /leads-ganho-mapa:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao carregar dados do mapa.'
      });
    }
  }

// =====================================================
// NOVO ENDPOINT - MOTIVOS DE PERDA
// =====================================================
static async getLossReasons(req, res) {
  try {
    let filters = req.body.filters || req.query.filters || {};
    if (typeof filters === 'string') {
      try { filters = JSON.parse(filters); } catch (e) { filters = {}; }
    }

    const userId = req.user?.id || null;
    const isAdmin = req.user?.role === 'Admin' || false;

    let query = `
      SELECT 
        reason_for_loss AS reason,
        COUNT(*) AS total
      FROM leads
      WHERE status = 'Perdido'
        AND reason_for_loss IS NOT NULL
        AND reason_for_loss <> ''
    `;

    const conditions = [];
    const values = [];

    // filtro por data
    if (filters.startDate && filters.endDate) {
      conditions.push(`date_lost BETWEEN $${values.length + 1} AND $${values.length + 2}`);
      values.push(filters.startDate, filters.endDate);
    }

    // filtro por vendedor (admin seleciona)
    if (filters.vendedor && filters.vendedor !== 'todos') {
      conditions.push(`seller_id = $${values.length + 1}`);
      values.push(filters.vendedor);
    }

    // usuário comum vê somente seus leads
    if (!isAdmin) {
      conditions.push(`seller_id = $${values.length + 1}`);
      values.push(userId);
    }



    if (conditions.length > 0) {
      query += " AND " + conditions.join(" AND ");
    }

    query += `
      GROUP BY reason_for_loss
      ORDER BY total DESC
    `;


    const result = await pool.query(query, values);

    const total = result.rows.reduce((acc, r) => acc + Number(r.total), 0);

    const formatted = result.rows.map(r => ({
      reason: r.reason,
      total: Number(r.total),
      percent: total > 0 ? Number(((r.total / total) * 100).toFixed(1)) : 0
    }));

    return res.status(200).json({
      success: true,
      data: formatted
    });

  } catch (error) {
    console.error("Erro ao buscar motivos de perda:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao carregar motivos de perda."
    });
  }
}


}


module.exports = ReportController;
