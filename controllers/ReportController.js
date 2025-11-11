// controllers/ReportController.js
const { pool } = require('../config/db');
const ReportDataService = require('../services/ReportDataService');
const pdfKit = require('pdfkit');
const ExcelJS = require('exceljs');

class ReportController {
  constructor() {
    this.getVendors = this.getVendors.bind(this);
    this.getReportData = this.getReportData.bind(this);
    this.getAnalyticNotes = this.getAnalyticNotes.bind(this);
    this.exportCsv = this.exportCsv.bind(this);
    this.exportPdf = this.exportPdf.bind(this);
  }

  // GET /api/v1/reports/sellers  (retorna array simples, sem wrapper)
  async getVendors(req, res) {
    try {
      const isAdmin = req.user?.role === 'Admin';
      const query = isAdmin
        ? `SELECT id, name, email, role FROM users ORDER BY name`
        : `SELECT id, name, email, role FROM users WHERE id = $1 ORDER BY name`;
      const values = isAdmin ? [] : [req.user.id];
      const result = await pool.query(query, values);
      // Retorna array direto (frontend espera array)
      return res.status(200).json(result.rows || []);
    } catch (error) {
      console.error('Erro ao buscar vendedores:', error);
      return res.status(500).json({ error: 'Erro ao buscar vendedores.' });
    }
  }

  // GET/POST /api/v1/reports  -> aceita query params simples: startDate,endDate,ownerId,source
  async getReportData(req, res) {
    try {
      // Aceita filtros por query ou body (compatível com chamadas GET e POST)
      const source = req.query.source ?? req.body.source;
      const startDate = req.query.startDate ?? req.body.startDate;
      const endDate = req.query.endDate ?? req.body.endDate;
      const ownerId = req.query.ownerId ?? req.body.ownerId ?? (req.user?.id || null);

      const filters = {
        source: source ?? 'all',
        startDate: startDate || null,
        endDate: endDate || null,
        ownerId: ownerId == null ? 'all' : ownerId
      };

      const userId = req.user?.id || null;
      const isAdmin = req.user?.role === 'Admin' || false;

      const metrics = await ReportDataService.getDashboardMetrics(filters, userId, isAdmin);

      // Retorna diretamente o objeto esperado pelo frontend (sem nested wrappers)
      return res.status(200).json(metrics);

    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
      return res.status(500).json({ error: 'Erro interno ao buscar dados do dashboard.' });
    }
  }

  async getAnalyticNotes(req, res) {
    try {
      const { leadId } = req.params;
      const notes = await ReportDataService.getAnalyticNotes(leadId);
      return res.status(200).json(notes || []);
    } catch (error) {
      console.error('Erro ao buscar notas analíticas:', error);
      return res.status(500).json({ error: 'Erro ao buscar notas analíticas.' });
    }
  }

  async exportCsv(req, res) {
    try {
      const source = req.query.source ?? req.body.source;
      const startDate = req.query.startDate ?? req.body.startDate;
      const endDate = req.query.endDate ?? req.body.endDate;
      const ownerId = req.query.ownerId ?? req.body.ownerId ?? (req.user?.id || null);

      const filters = { source: source ?? 'all', startDate: startDate || null, endDate: endDate || null, ownerId: ownerId == null ? 'all' : ownerId };
      const userId = req.user?.id || null;
      const isAdmin = req.user?.role === 'Admin' || false;

      const leads = await ReportDataService.getLeadsForExport(filters, userId, isAdmin);
      if (!leads || leads.length === 0) {
        return res.status(404).json({ error: 'Nenhum lead encontrado para exportação.' });
      }

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Relatório de Leads');

      sheet.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Nome', key: 'name', width: 30 },
        { header: 'Telefone', key: 'phone', width: 15 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Origem', key: 'origin', width: 15 },
        { header: 'Proprietário', key: 'owner_name', width: 25 },
        { header: 'Consumo Médio (KW)', key: 'avg_consumption', width: 20 },
        { header: 'Data de Criação', key: 'created_at', width: 20 }
      ];

      leads.forEach(lead => {
        sheet.addRow({
          id: lead.id,
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          status: lead.status,
          origin: lead.origin,
          owner_name: lead.owner_name,
          avg_consumption: lead.avg_consumption || 0,
          created_at: new Date(lead.created_at).toLocaleString('pt-BR')
        });
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=leads_${new Date().toISOString().slice(0,10)}.csv`);
      await workbook.csv.write(res);
      res.end();
    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
      res.status(500).json({ error: 'Erro ao gerar CSV.' });
    }
  }

  async exportPdf(req, res) {
    try {
      const source = req.query.source ?? req.body.source;
      const startDate = req.query.startDate ?? req.body.startDate;
      const endDate = req.query.endDate ?? req.body.endDate;
      const ownerId = req.query.ownerId ?? req.body.ownerId ?? (req.user?.id || null);

      const filters = { source: source ?? 'all', startDate: startDate || null, endDate: endDate || null, ownerId: ownerId == null ? 'all' : ownerId };
      const userId = req.user?.id || null;
      const isAdmin = req.user?.role === 'Admin' || false;

      const metrics = await ReportDataService.getDashboardMetrics(filters, userId, isAdmin);
      const leads = await ReportDataService.getLeadsForExport(filters, userId, isAdmin);
      const prod = metrics.productivity || {};

      const doc = new pdfKit();
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=relatorio_${new Date().toISOString().slice(0,10)}.pdf`);
        res.send(Buffer.concat(chunks));
      });

      doc.fontSize(20).text('Relatório CRM', { align: 'left' });
      doc.moveDown();
      doc.fontSize(12).text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
      doc.moveDown();

      doc.fontSize(14).text('Métricas principais:');
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Leads Ativos: ${ (prod.leadsActive || 0).toLocaleString('pt-BR') }`);
      doc.text(`Vendas Concluídas: ${ (prod.totalWonCount || 0).toLocaleString('pt-BR') }`);
      doc.text(`Valor Total (kW): ${ (prod.totalWonValueKW || 0).toFixed(2).replace('.', ',') } kW`);
      doc.text(`Taxa de Conversão: ${ ((prod.conversionRate || 0) * 100).toFixed(2).replace('.', ',') }%`);
      doc.text(`Tempo Médio de Fechamento: ${ (prod.avgClosingTimeDays || 0).toFixed(1).replace('.', ',') } dias`);

      doc.end();

    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      res.status(500).json({ error: 'Erro ao gerar PDF.' });
    }
  }
}

module.exports = new ReportController();
