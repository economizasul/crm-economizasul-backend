// controllers/ReportController.js
const { pool } = require('../config/db');
const ReportDataService = require('../services/ReportDataService');
const pdfKit = require('pdfkit');
const ExcelJS = require('exceljs');

class ReportController {
  constructor() {
    this.getSellers = this.getSellers.bind(this);
    this.getReportData = this.getReportData.bind(this);
    this.getAnalyticNotes = this.getAnalyticNotes.bind(this);
    this.exportCsv = this.exportCsv.bind(this);
    this.exportPdf = this.exportPdf.bind(this);
  }

  // =============================================================
  // 1️⃣ LISTAR VENDEDORES REAIS (tabela users)
  // =============================================================
  async getSellers(req, res) {
    try {
      const isAdmin = req.user?.role === 'Admin' || false;

      // Admin vê todos; vendedor comum vê apenas ele mesmo
      const query = isAdmin
        ? `SELECT id, name, email, role FROM users ORDER BY name;`
        : `SELECT id, name, email, role FROM users WHERE id = $1 ORDER BY name;`;

      const values = isAdmin ? [] : [req.user.id];
      const result = await pool.query(query, values);

      if (!result.rows || result.rows.length === 0) {
        return res.status(200).json({ success: true, data: [] });
      }

      res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
      console.error('❌ Erro ao buscar vendedores:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno ao buscar vendedores.',
        details: error.message
      });
    }
  }

  // =============================================================
  // 2️⃣ DADOS DO DASHBOARD
  // =============================================================
  async getReportData(req, res) {
  try {
    // Normaliza filtros (aceita GET ou POST)
    const filters = req.body.filters || req.query || {};
    const userId = req.user?.id || null;
    const isAdmin = req.user?.role === 'Admin' || false;

    // ✅ Sanitiza datas
    if (filters.startDate && isNaN(new Date(filters.startDate).getTime())) {
      delete filters.startDate;
    }
    if (filters.endDate && isNaN(new Date(filters.endDate).getTime())) {
      delete filters.endDate;
    }

    const metrics = await ReportDataService.getDashboardMetrics(filters, userId, isAdmin);
    return res.status(200).json({ success: true, data: metrics });
  } catch (error) {
    console.error('❌ Erro ao buscar dados do dashboard:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao buscar dados do dashboard.',
      details: error.message
    });
  }
}

  // =============================================================
  // 3️⃣ NOTAS ANALÍTICAS
  // =============================================================
  async getAnalyticNotes(req, res) {
    try {
      const { leadId } = req.params;
      const notes = await ReportDataService.getAnalyticNotes(leadId);
      return res.status(200).json({ success: true, data: notes || [] });
    } catch (error) {
      console.error('Erro ao buscar notas analíticas:', error);
      res.status(500).json({ success: false, message: 'Erro ao buscar notas.' });
    }
  }

  // =============================================================
  // 4️⃣ EXPORTAÇÃO CSV
  // =============================================================
  async exportCsv(req, res) {
    try {
      const filters = req.body.filters || req.query.filters || {};
      const userId = req.user?.id || null;
      const isAdmin = req.user?.role === 'Admin' || false;

      const leads = await ReportDataService.getLeadsForExport(filters, userId, isAdmin);
      if (leads.length === 0) {
        return res.status(404).json({ success: false, message: 'Nenhum lead encontrado para exportação.' });
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
        { header: 'Consumo Médio (KW)', key: 'avg_consumption', width: 25 },
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
          created_at: new Date(lead.created_at).toLocaleDateString('pt-BR')
        });
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=leads_${new Date().toISOString().slice(0, 10)}.csv`);
      await workbook.csv.write(res);
      res.end();
    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
      res.status(500).json({ success: false, message: 'Erro interno ao gerar CSV.' });
    }
  }

  // =============================================================
  // 5️⃣ EXPORTAÇÃO PDF
  // =============================================================
  async exportPdf(req, res) {
    try {
      const filters = req.body.filters || req.query.filters || {};
      const userId = req.user?.id || null;
      const isAdmin = req.user?.role === 'Admin' || false;

      const metrics = await ReportDataService.getDashboardMetrics(filters, userId, isAdmin);
      const leads = await ReportDataService.getLeadsForExport(filters, userId, isAdmin);
      const prod = metrics.productivity;

      const doc = new pdfKit();
      const pdfData = [];
      doc.on('data', chunk => pdfData.push(chunk));
      doc.on('end', () => {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=relatorio_${new Date().toISOString().slice(0, 10)}.pdf`);
        res.send(Buffer.concat(pdfData));
      });

      doc.fontSize(25).text('Relatório CRM - EconomizaSul', 50, 50);
      doc.fontSize(12).text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 50, 80);
      doc.moveDown(2);

      doc.fontSize(18).text('Métricas de Produtividade', 50, doc.y);
      doc.moveDown(0.5);

      const tableData = [
        ['Métrica', 'Valor'],
        ['Leads Ativos', prod.leadsActive.toLocaleString('pt-BR')],
        ['Vendas Concluídas (Qtd)', prod.totalWonCount.toLocaleString('pt-BR')],
        ['Valor Total (KW)', `${prod.totalWonValueKW.toFixed(2).replace('.', ',')} kW`],
        ['Taxa de Conversão', `${(prod.conversionRate * 100).toFixed(2).replace('.', ',')}%`],
        ['Taxa de Perda', `${(prod.lossRate * 100).toFixed(2).replace('.', ',')}%`],
        ['Tempo Médio de Fechamento', `${prod.avgClosingTimeDays.toFixed(1)} dias`],
      ];

      let y = doc.y;
      doc.font('Helvetica-Bold');
      doc.text('Métrica', 50, y, { width: 250 });
      doc.text('Valor', 350, y);
      y += 20;

      doc.font('Helvetica');
      tableData.slice(1).forEach(row => {
        doc.text(row[0], 50, y, { width: 250 });
        doc.text(row[1], 350, y);
        y += 15;
      });

      doc.end();
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      res.status(500).json({ success: false, message: 'Erro interno ao gerar PDF.' });
    }
  }
}

module.exports = new ReportController();
