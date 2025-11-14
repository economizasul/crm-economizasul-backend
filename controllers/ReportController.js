// controllers/ReportController.js
const { pool } = require('../config/db');
const ReportDataService = require('../services/ReportDataService');
const CsvGeneratorService = require('../services/CsvGeneratorService'); 
const PdfGeneratorService = require('../services/PdfGeneratorService'); 
// 🚨 CORREÇÃO: Removida a importação de LeadAnalyticNote para evitar o erro de deploy

class ReportController {
  constructor() {
    this.getVendors = ReportController.getVendors.bind(this);
    this.getReportData = ReportController.getReportData.bind(this);
    this.getAnalyticNotes = ReportController.getAnalyticNotes.bind(this);
    this.exportCsv = ReportController.exportCsv.bind(this);
    this.exportPdf = ReportController.exportPdf.bind(this);
  }

  static async getVendors(req, res) {
    try {
      // ... (Lógica inalterada)
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
   */
  static async getReportData(req, res) {
    try {
      // 1. Extração e Parsing de Filtros (CRÍTICO para GET/POST)
      let filters = req.body.filters || req.query.filters || {}; 
      
      if (typeof filters === 'string') {
          try {
              filters = JSON.parse(filters);
          } catch (e) {
              console.error('Erro ao fazer JSON.parse nos filtros:', e);
              filters = {}; 
          }
      }
      
      const userId = req.user?.id || null;
      const isAdmin = req.user?.role === 'Admin' || false;
      
      // 2. Chama o serviço principal
      const data = await ReportDataService.getAllDashboardData(filters, userId, isAdmin); 
      
      return res.status(200).json({ success: true, data });

    } catch (error) {
      // 3. Tratamento de Erro (Retorna a mensagem para o frontend)
      console.error('ERRO INTERNO: ReportController.getReportData falhou:', error.message);
      return res.status(500).json({ 
        success: false, 
        message: 'Falha ao carregar dados do relatório. Verifique o log do servidor para o erro SQL detalhado.' 
      });
    }
  }
  
  static async getAnalyticNotes(req, res) {
    try {
        // ... (Função placeholder)
        return res.status(200).json({ success: true, data: [] }); 
    } catch (error) {
        console.error('Erro ao buscar notas analíticas:', error);
        return res.status(500).json({ success: false, message: 'Erro ao buscar notas analíticas.' });
    }
  }

  static async exportCsv(req, res) {
    try {
      // ... (Lógica de exportação)
      const filters = req.body.filters || req.query.filters || {};
      
      if (typeof filters === 'string') {
          filters = JSON.parse(filters);
      }
      
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
      // ... (Lógica de exportação)
      const filters = req.body.filters || req.query.filters || {};

      if (typeof filters === 'string') {
          filters = JSON.parse(filters);
      }
      
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
       
       let message = 'Erro interno ao gerar PDF.';
       if (error.message.includes('Timeout') || error.message.includes('launch')) {
        message = 'Falha crítica ao iniciar o navegador (Chromium) para o PDF.';
       }

       return res.status(500).json({ 
        success: false, 
        message: message 
       });
    }
  }
}

module.exports = ReportController;