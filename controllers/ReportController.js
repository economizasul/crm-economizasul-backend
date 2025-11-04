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

  async getReportData(req, res) {
    try {
      const { filters, userId, isAdmin } = req.body.context;
      const metrics = await ReportDataService.getDashboardMetrics(filters, userId, isAdmin);
      res.status(200).json({ success: true, data: metrics });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
  }

  async getAnalyticNotes(req, res) {
    try {
      const { leadId } = req.params;
      const notes = await ReportDataService.getAnalyticNotes(leadId);
      if (!notes) return res.status(404).json({ success: false, message: 'Lead não encontrado.' });
      res.status(200).json({ success: true, data: notes });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
  }

  async exportCsv(req, res) {
    try {
      const { filters, userId, isAdmin } = req.body.context;
      const leadData = await ReportDataService.getLeadsForExport(filters, userId, isAdmin);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Leads');

      worksheet.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Nome', key: 'name', width: 30 },
        { header: 'Telefone', key: 'phone', width: 20 },
        { header: 'E-mail', key: 'email', width: 30 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Origem', key: 'origin', width: 15 },
        { header: 'Proprietário', key: 'owner_name', width: 20 },
        { header: 'Criado em', key: 'created_at', width: 20 },
        { header: 'Economia Estimada', key: 'estimated_savings', width: 18 }
      ];

      worksheet.addRows(leadData.map(lead => ({
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email || '',
        status: lead.status,
        origin: lead.origin,
        owner_name: lead.owner_name || 'Desconhecido',
        created_at: new Date(lead.created_at).toLocaleString('pt-BR'),
        estimated_savings: lead.estimated_savings ? Number(lead.estimated_savings).toFixed(2) : '0.00'
      })));

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=leads_${new Date().toISOString().slice(0, 10)}.xlsx`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      res.status(500).json({ error: 'Erro ao exportar CSV.' });
    }
  }

  async exportPdf(req, res) {
    try {
      const { filters, userId, isAdmin } = req.body.context;
      const metrics = await ReportDataService.getDashboardMetrics(filters, userId, isAdmin);

      const doc = new pdfKit();
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=relatorio_${new Date().toISOString().slice(0, 10)}.pdf`);
        res.send(pdfData);
      });

      doc.fontSize(25).text('Relatório CRM - EconomizaSul', 50, 50);
      doc.fontSize(12).text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 50, 80);
      doc.moveDown(2);

      const table = [
        ['Métrica', 'Valor'],
        ['Leads Ativos', metrics.productivity.leadsActive.toString()],
        ['Vendas Ganhas', metrics.productivity.totalWonCount.toString()],
        ['Valor Total', `R$ ${metrics.productivity.totalWonValue.toFixed(2)}`],
        ['Taxa de Conversão', `${(metrics.productivity.conversionRate * 100).toFixed(1)}%`],
        ['Taxa de Perda', `${(metrics.productivity.lossRate * 100).toFixed(1)}%`],
        ['Tempo Médio (dias)', metrics.productivity.avgClosingTimeDays.toFixed(1)]
      ];

      let y = doc.y;
      doc.font('Helvetica-Bold');
      doc.text(table[0][0], 50, y, { width: 250 });
      doc.text(table[0][1], 350, y);
      y += 20;

      doc.font('Helvetica');
      for (let i = 1; i < table.length; i++) {
        doc.text(table[i][0], 50, y, { width: 250 });
        doc.text(table[i][1], 350, y);
        y += 15;
      }

      doc.end();
    } catch (error) {
      res.status(500).json({ error: 'Erro ao exportar PDF.' });
    }
  }
}

module.exports = new ReportController();