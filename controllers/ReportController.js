// controllers/ReportController.js

const { pool } = require('../config/db');
const ReportDataService = require('../services/ReportDataService');
const CsvGeneratorService = require('../services/CsvGeneratorService'); 
// Importação do serviço de PDF que deve ser a versão robusta
const PdfGeneratorService = require('../services/PdfGeneratorService'); 

class ReportController {

 /**
   * Lista vendedores reais (tabela users). Admin vê todos, user vê só ele.
   * @route GET /reports/sellers
   */
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

  /**
   * Rota principal para buscar dados agregados do Dashboard de Relatórios.
   * @route POST/GET /reports/data
   */
  static async getReportData(req, res) {
    try {
      let filters = req.body.filters || req.query.filters || {};

      if (typeof filters === 'string') {
        try {
          filters = JSON.parse(filters);
        } catch (e) {
          console.error('Filtros em formato inválido:', e);
          return res.status(400).json({ success: false, message: 'Filtros em formato JSON inválido.' });
        }
      }

      const userId = req.user?.id || null;
      const isAdmin = req.user?.role === 'Admin' || false;

      const data = await ReportDataService.getAllDashboardData(filters, userId, isAdmin);

      return res.status(200).json({ success: true, data });

    } catch (error) {
      console.error('Erro ao buscar dados do relatório:', error);
      return res.status(500).json({ success: false, message: 'Erro interno ao gerar dados do relatório.' });
    }
  }

  // Rota de Notas Analíticas (Mantida, se for usada em outra rota)
  static async getAnalyticNotes(req, res) { 
      // Esta função deve ser implementada se você a usa no seu roteador
      return res.status(501).json({ success: false, message: 'Endpoint getAnalyticNotes não implementado.' });
  }


  // Rota de Exportação CSV
  static async exportCsv(req, res) {
    try {
      let filters = req.body.filters || req.query.filters || {};
      if (typeof filters === 'string') filters = JSON.parse(filters);

      const userId = req.user?.id || null;
      const isAdmin = req.user?.role === 'Admin' || false;

      const leads = await ReportDataService.getLeadsForExport(filters, userId, isAdmin);

      const csvString = await CsvGeneratorService.exportLeads(leads);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=relatorio_leads_${new Date().toISOString().slice(0, 10)}.csv`);
      res.status(200).send(Buffer.from('\ufeff' + csvString, 'utf8'));

    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
      res.status(500).json({ success: false, message: 'Erro interno ao gerar CSV.' });
    }
  }

  // Rota de Exportação PDF 🚨 CORRIGIDA COM TRATAMENTO DE ERRO ROBUSTO
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
      return res.status(200).send(pdfBuffer); // Adicionado 'return' para garantir que a função encerre
    } catch (error) {
       // 🚨 TRATAMENTO DE ERRO APRIMORADO PARA PUPPETEER
       console.error('Erro ao exportar PDF (ReportController):', error.message);

       let message = 'Erro interno ao gerar PDF.';
       // Verifica se o erro é um crash do Puppeteer/Chromium, que é o mais provável no Render
       if (error.message.includes('Timeout') || error.message.includes('launch') || error.message.includes('executablePath')) {
        message = 'Falha crítica ao iniciar o navegador (Chromium) para o PDF. Verifique se o Render instalou as dependências corretas (puppeteer-core e @sparticuz/chromium) e se o serviço PdfGeneratorService.js está atualizado.';
       }

       return res.status(500).json({ 
        success: false, 
        message: message,
        internalError: error.message
       });
     }
  }
}

module.exports = ReportController;