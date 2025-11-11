// controllers/ReportController.js
const ReportDataService = require('../services/ReportDataService');
const pdfKit = require('pdfkit');
const ExcelJS = require('exceljs');

class ReportController {
  constructor() {
    this.getReportData = this.getReportData.bind(this);
    this.getAnalyticNotes = this.getAnalyticNotes.bind(this);
    this.exportCsv = this.exportCsv.bind(this);
    this.exportPdf = this.exportPdf.bind(this);
  }

  /**
   * GET /api/v1/reports (ou POST) - retorna objeto direto com métricas
   */
  async getReportData(req, res) {
    try {
      // Filtros podem vir em query params (GET) ou no body (POST)
      const filters = Object.assign({}, req.query || {}, req.body?.filters || {});
      const userId = req.user.id;
      const isAdmin = req.user.role === 'Admin';

      const metrics = await ReportDataService.getDashboardMetrics(filters, userId, isAdmin);

      // Retorna objeto direto (frontend espera data.productivity etc.)
      return res.status(200).json(metrics);
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
      return res.status(500).json({ message: 'Erro interno do servidor ao buscar dados do dashboard.' });
    }
  }

  async getAnalyticNotes(req, res) {
    try {
      const { leadId } = req.params;
      const notes = await ReportDataService.getAnalyticNotes(leadId);
      return res.status(200).json(notes || []);
    } catch (error) {
      console.error('Erro ao buscar notas analíticas:', error);
      return res.status(500).json({ message: 'Erro interno do servidor ao buscar notas.' });
    }
  }

  async exportCsv(req, res) {
    try {
      const filters = Object.assign({}, req.query || {}, req.body?.filters || {});
      const userId = req.user.id;
      const isAdmin = req.user.role === 'Admin';

      const leads = await ReportDataService.getLeadsForExport(filters, userId, isAdmin);
      if (!leads || leads.length === 0) {
        return res.status(404).json({ message: 'Nenhum lead encontrado para exportação.' });
      }

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Relatório de Leads');

      sheet.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Nome', key: 'name', width: 30 },
        { header: 'Telefone', key: 'phone', width: 18 },
        { header: 'Email', key: 'email', width: 28 },
        { header: 'Status', key: 'status', width: 20 },
        { header: 'Origem', key: 'origin', width: 18 },
        { header: 'Proprietário', key: 'owner_name', width: 20 },
        { header: 'Consumo (kW)', key: 'avg_consumption', width: 18 },
        { header: 'Data de Criação', key: 'created_at', width: 22 }
      ];

      leads.forEach(l => {
        sheet.addRow({
          id: l.id,
          name: l.name,
          phone: l.phone,
          email: l.email,
          status: l.status,
          origin: l.origin,
          owner_name: l.owner_name,
          avg_consumption: l.avg_consumption,
          created_at: l.created_at
        });
      });

      // Resposta CSV via stream
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=leads_export_${new Date().toISOString().slice(0,10)}.csv`);

      await workbook.csv.write(res);
      res.end();
    } catch (err) {
      console.error('Erro ao exportar CSV:', err);
      res.status(500).json({ message: 'Erro interno ao gerar CSV.' });
    }
  }

  async exportPdf(req, res) {
    try {
      const filters = Object.assign({}, req.query || {}, req.body?.filters || {});
      const userId = req.user.id;
      const isAdmin = req.user.role === 'Admin';

      const metrics = await ReportDataService.getDashboardMetrics(filters, userId, isAdmin);
      const leads = await ReportDataService.getLeadsForExport(filters, userId, isAdmin);
      const prod = metrics.productivity || {};

      const doc = new pdfKit({ margin: 40 });
      const buffers = [];
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=relatorio_${new Date().toISOString().slice(0,10)}.pdf`);
        res.send(pdfData);
      });

      doc.fontSize(18).text('Relatório CRM', { align: 'left' });
      doc.moveDown();
      doc.fontSize(12).text(`Período: ${filters.startDate || '-'} → ${filters.endDate || '-'}`);
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
      doc.moveDown();

      doc.fontSize(14).text('Métricas de Produtividade');
      doc.moveDown(0.5);

      const table = [
        ['Leads Ativos', prod.leadsActive || 0],
        ['Vendas Concluídas (Qtd)', prod.totalWonCount || 0],
        ['Valor Total de Vendas (kW)', `${(prod.totalWonValueKW || 0).toFixed(2)} kW`],
        ['Taxa de Conversão', `${((prod.conversionRate || 0) * 100).toFixed(2)}%`],
        ['Taxa de Perda', `${((prod.lossRate || 0) * 100).toFixed(2)}%`],
        ['Tempo Médio de Fechamento', `${(prod.avgClosingTimeDays || 0).toFixed(1)} dias`]
      ];

      table.forEach(row => {
        doc.font('Helvetica-Bold').text(row[0], { continued: true, width: 300 });
        doc.font('Helvetica').text(`: ${row[1]}`);
      });

      doc.moveDown();

      if (leads && leads.length > 0) {
        doc.fontSize(12).text(`Leads (${leads.length}) - amostra:`);
        doc.moveDown(0.5);
        const sample = leads.slice(0, 20);
        sample.forEach(l => {
          doc.font('Helvetica-Bold').text(l.name || '—', { continued: true });
          doc.font('Helvetica').text(` — ${l.status} — ${l.owner_name || '—'} — ${l.avg_consumption || 0} kW`);
        });
      } else {
        doc.text('Nenhum lead para listar no período.');
      }

      doc.end();
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      res.status(500).json({ message: 'Erro interno ao gerar PDF.' });
    }
  }
}

module.exports = new ReportController();
