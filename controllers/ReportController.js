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
      let filters = req.body.filters || req.query.filters || {};
      if (typeof filters === 'string') {
        try { filters = JSON.parse(filters); } catch (e) { filters = {}; }
      }

      const userId = req.user?.id || null;
      const isAdmin = req.user?.role === 'Admin' || false;

      const data = await ReportDataService.getAllDashboardData(filters, userId, isAdmin);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('ERRO INTERNO: ReportController.getReportData falhou:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Falha ao carregar dados do relatório.'
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
      console.error('Erro ao exportar PDF (ReportController):', error.message);
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
          l.cidade,
          l.google_maps_link,
          l.regiao
        FROM leads l
        WHERE l.status = 'Ganho'
          AND l.deleted_at IS NULL
          AND l.google_maps_link IS NOT NULL
          AND l.google_maps_link != ''
      `;

      const conditions = [];
      const values = [];

      if (filters.startDate && filters.endDate) {
        conditions.push(`l.data_ganho BETWEEN $${values.length + 1} AND $${values.length + 2}`);
        values.push(filters.startDate, filters.endDate);
      }

      if (filters.vendedor && filters.vendedor !== 'todos') {
        conditions.push(`l.vendedor_id = $${values.length + 1}`);
        values.push(filters.vendedor);
      }

      if (!isAdmin) {
        conditions.push(`l.vendedor_id = $${values.length + 1}`);
        values.push(userId);
      }

      if (conditions.length > 0) {
        query += ' AND ' + conditions.join(' AND ');
      }

      query += ' ORDER BY l.data_ganho DESC';

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
}

module.exports = ReportController;