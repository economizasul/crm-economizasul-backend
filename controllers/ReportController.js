// controllers/ReportController.js
const { pool } = require('../config/db');
const ReportDataService = require('../services/ReportDataService');
// Assumindo que você tem serviços dedicados (GsvGeneratorService e PdfGeneratorService)
const CsvGeneratorService = require('../services/CsvGeneratorService'); 
const PdfGeneratorService = require('../services/PdfGeneratorService'); 

class ReportController {
  constructor() {
    this.getVendors = this.getVendors.bind(this);
    this.getReportData = this.getReportData.bind(this);
    this.exportCsv = this.exportCsv.bind(this);
    this.exportPdf = this.exportPdf.bind(this);
  }

  // Lista vendedores reais (Método Inalterado)
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
      return res.status(500).json({ success: false, message: 'Erro ao buscar vendedores.' });
    }
  }

  /**
   * Rota principal para buscar dados agregados do Dashboard de Relatórios.
   * Suporta POST (body) e GET (query) para filtros.
   * @route POST/GET /reports/data
   */
  async getReportData(req, res) {
    try {
      // Pega filtros do corpo (POST) ou da query (GET)
      let filters = req.body.filters || req.query.filters || {};
      
      // Converte o JSON string da query string para objeto se vier via GET
      if (typeof filters === 'string') {
        try {
          filters = JSON.parse(filters);
        } catch (e) {
          console.error('Filtros em formato inválido:', e);
          return res.status(400).json({ success: false, message: 'Filtros em formato JSON inválido.' });
        }
      }

      // Identifica o usuário e seu papel para aplicar filtros de segurança
      const userId = req.user?.id || null;
      const isAdmin = req.user?.role === 'Admin' || false;
      
      // Chama o serviço de dados para calcular todas as métricas de forma eficiente
      const data = await ReportDataService.getAllDashboardData(filters, userId, isAdmin);
      
      return res.status(200).json({ success: true, data });
      
    } catch (error) {
      console.error('Erro ao buscar dados do relatório:', error);
      return res.status(500).json({ success: false, message: 'Erro interno ao gerar dados do relatório.' });
    }
  }
  
  // Rota de Exportação CSV
  async exportCsv(req, res) {
    try {
      // Pega filtros do corpo (POST) ou da query (GET)
      let filters = req.body.filters || req.query.filters || {};
      if (typeof filters === 'string') filters = JSON.parse(filters);

      const userId = req.user?.id || null;
      const isAdmin = req.user?.role === 'Admin' || false;

      // Busca os leads brutos
      const leads = await ReportDataService.getLeadsForExport(filters, userId, isAdmin);
      
      // Gera o CSV
      const csvString = await CsvGeneratorService.exportLeads(leads);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=relatorio_leads_${new Date().toISOString().slice(0, 10)}.csv`);
      res.status(200).send(Buffer.from('\ufeff' + csvString, 'utf8')); // Adiciona BOM para UTF-8 no Excel
      
    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
      res.status(500).json({ success: false, message: 'Erro interno ao gerar CSV.' });
    }
  }

  // Rota de Exportação PDF
  async exportPdf(req, res) {
    try {
      // Pega filtros do corpo (POST) ou da query (GET)
      let filters = req.body.filters || req.query.filters || {};
      if (typeof filters === 'string') filters = JSON.parse(filters);

      const userId = req.user?.id || null;
      const isAdmin = req.user?.role === 'Admin' || false;

      // Busca todos os dados necessários (métricas e leads)
      const metrics = await ReportDataService.getAllDashboardData(filters, userId, isAdmin);
      const leadsForPdf = await ReportDataService.getLeadsForExport(filters, userId, isAdmin);
      
      // Delega a geração do PDF para o serviço
      const pdfBuffer = await PdfGeneratorService.generateFullReportPdf({
          metrics, 
          leads: leadsForPdf, 
          filters: filters,
          generatorName: req.user?.name || 'Sistema',
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=relatorio_completo_${new Date().toISOString().slice(0, 10)}.pdf`);
      res.status(200).send(pdfBuffer);
      
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      res.status(500).json({ success: false, message: 'Erro interno ao gerar PDF.' });
    }
  }
}

module.exports = new ReportController();