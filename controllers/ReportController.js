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

  // Lista vendedores reais (tabela users). Admin vê todos, user vê só ele.
  async getVendors(req, res) {
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
      return res.status(500).json({ success: false, message: 'Erro ao buscar vendedores.', details: error.message });
    }
  }

  // Recebe filtros (pode vir vendorId do frontend). Mapeia vendorId -> ownerId internamente.
  async getReportData(req, res) {
    try {
      // aceita tanto GET (query) quanto POST (body)
      const raw = req.body || req.query || {};

      // O frontend usa 'vendorId' (FilterBar). Aceitamos também 'ownerId' por compatibilidade.
      const vendorId = raw.vendorId ?? raw.ownerId ?? raw.ownerid ?? raw.owner_id ?? null;
      const startDate = raw.startDate ?? raw.dateStart ?? null;
      const endDate = raw.endDate ?? raw.dateEnd ?? null;
      const source = raw.source ?? raw.sources ?? 'all';

      // Constrói o objeto de filtros no formato que o ReportDataService espera.
      const filters = {
        startDate: startDate || null,
        endDate: endDate || null,
        source: source || 'all',
        // quando frontend enviar 'vendorId' ele ficará disponível; serviço decidirá se usa
        ownerId: vendorId === undefined ? null : vendorId
      };

      const userId = req.user?.id ?? null;
      const isAdmin = req.user?.role === 'Admin';

      // DEBUG opcional (comente em produção)
      // console.debug('getReportData -> filters:', filters, 'userId:', userId, 'isAdmin:', isAdmin);

      const metrics = await ReportDataService.getDashboardMetrics(filters, userId, isAdmin);
      return res.status(200).json({ success: true, data: metrics });
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
      return res.status(500).json({ success: false, message: 'Erro interno ao buscar dados do dashboard.', details: error.message });
    }
  }

  async getAnalyticNotes(req, res) {
    try {
      const { leadId } = req.params;
      const notes = await ReportDataService.getAnalyticNotes(leadId);
      return res.status(200).json({ success: true, data: notes || [] });
    } catch (error) {
      console.error('Erro ao buscar notas analíticas:', error);
      res.status(500).json({ success: false, message: 'Erro interno ao buscar notas.' });
    }
  }

  async exportCsv(req, res) {
    try {
      const filters = req.body.filters || req.query.filters || {};
      const userId = req.user?.id || null;
      const isAdmin = req.user?.role === 'Admin' || false;

      const leads = await ReportDataService.getLeadsForExport(filters, userId, isAdmin);
      if (!leads || leads.length === 0) {
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
          created_at: lead.created_at ? new Date(lead.created_at).toLocaleDateString('pt-BR') : ''
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

  async exportPdf(req, res) {
    try {
      const filters = req.body.filters || req.query.filters || {};
      const userId = req.user?.id || null;
      const isAdmin = req.user?.role === 'Admin' || false;

      const metrics = await ReportDataService.getDashboardMetrics(filters, userId, isAdmin);
      const leads = await ReportDataService.getLeadsForExport(filters, userId, isAdmin);
      const prod = metrics.productivity;

      const doc = new pdfKit();
      const pdfChunks = [];
      doc.on('data', c => pdfChunks.push(c));
      doc.on('end', () => {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=relatorio_${new Date().toISOString().slice(0, 10)}.pdf`);
        res.send(Buffer.concat(pdfChunks));
      });

      doc.fontSize(20).text('Relatório CRM - EconomizaSul', { align: 'left' });
      doc.moveDown();
      doc.fontSize(12).text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
      doc.moveDown();

      doc.fontSize(14).text('Métricas de Produtividade');
      doc.moveDown(0.5);

      doc.fontSize(11);
      doc.text(`Leads Ativos: ${prod.leadsActive}`);
      doc.text(`Vendas Concluídas (Qtd): ${prod.totalWonCount}`);
      doc.text(`Valor Total (kW): ${prod.totalWonValueKW?.toFixed(2).replace('.', ',') || '0,00'} kW`);
      doc.text(`Taxa de Conversão: ${(prod.conversionRate * 100).toFixed(2).replace('.', ',')}%`);
      doc.text(`Taxa de Perda: ${(prod.lossRate * 100).toFixed(2).replace('.', ',')}%`);
      doc.text(`Tempo Médio de Fechamento: ${prod.avgClosingTimeDays.toFixed(1)} dias`);

      if (leads && leads.length) {
        doc.moveDown();
        doc.fontSize(12).text(`Leads (${leads.length}):`);
        doc.fontSize(10);
        leads.slice(0, 20).forEach(l => {
          doc.text(`${l.name} — ${l.status} — ${l.avg_consumption || 0} kW — ${l.owner_name}`);
        });
      }

      doc.end();
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      res.status(500).json({ success: false, message: 'Erro interno ao gerar PDF.' });
    }
  }
}

module.exports = new ReportController();
