// controllers/ReportController.js
const { pool } = require('../config/db');
const ReportDataService = require('../services/ReportDataService');
// 🚨 Nota: Assumindo que os nomes de seus serviços são CsvGeneratorService e PdfGeneratorService
const CsvGeneratorService = require('../services/CsvGeneratorService'); 
const PdfGeneratorService = require('../services/PdfGeneratorService'); 
const LeadAnalyticNote = require('../models/LeadAnalyticNote'); // Se este modelo existir

class ReportController {
  constructor() {
    this.getVendors = ReportController.getVendors.bind(this);
    this.getReportData = ReportController.getReportData.bind(this);
    this.getAnalyticNotes = ReportController.getAnalyticNotes.bind(this);
    this.exportCsv = ReportController.exportCsv.bind(this);
    this.exportPdf = ReportController.exportPdf.bind(this);
  }

  /**
   * Lista vendedores reais (tabela users). Admin vê todos, user vê só ele.
   * @route GET /reports/vendors
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
      // 1. Extração de Filtros (ROBUSTA)
      let filters = req.body.filters || req.query.filters || {}; 
      
      // 🚨 CORREÇÃO CRÍTICA: Se a requisição for GET, o objeto 'filters' é recebido como STRING e precisa de PARSING
      if (typeof filters === 'string') {
          try {
              filters = JSON.parse(filters);
          } catch (e) {
              console.error('Erro ao fazer JSON.parse nos filtros:', e);
              // Caso o JSON esteja inválido, usamos um objeto vazio como fallback
              filters = {}; 
          }
      }
      
      const userId = req.user?.id || null;
      const isAdmin = req.user?.role === 'Admin' || false;
      
      // 2. Chama o serviço principal
      const data = await ReportDataService.getAllDashboardData(filters, userId, isAdmin); 
      
      // 3. Resposta de sucesso
      return res.status(200).json({ success: true, data });

    } catch (error) {
      // 4. Tratamento de Erro CRÍTICO (retorna o status 500)
      console.error('ERRO INTERNO: ReportController.getReportData falhou:', error.message);
      return res.status(500).json({ 
        success: false, 
        // Retorna uma mensagem de erro que ajuda na depuração
        message: 'Falha ao carregar dados do relatório. Verifique o log do servidor para o erro SQL detalhado.' 
      });
    }
  }
  
  /**
   * Rota para buscar notas analíticas de um Lead específico.
   * (Assumindo que você tem um modelo/serviço para isso)
   * @route GET /reports/analytic/:leadId
   */
  static async getAnalyticNotes(req, res) {
    try {
        const { leadId } = req.params;
        // 🚨 Placeholder: Assumindo que o LeadAnalyticNote existe.
        // const notes = await LeadAnalyticNote.findByLeadId(leadId); 
        return res.status(200).json({ success: true, data: [] }); // Placeholder
    } catch (error) {
        console.error('Erro ao buscar notas analíticas:', error);
        return res.status(500).json({ success: false, message: 'Erro ao buscar notas analíticas.' });
    }
  }

  /**
   * Rota de Exportação CSV
   * @route POST /reports/export/csv
   */
  static async exportCsv(req, res) {
    try {
      const filters = req.body.filters || req.query.filters || {};
      const userId = req.user?.id || null;
      const isAdmin = req.user?.role === 'Admin' || false;

      const leadsForExport = await ReportDataService.getLeadsForExport(filters, userId, isAdmin);
      
      // Delega a geração do CSV para o serviço
      const csvString = await CsvGeneratorService.exportLeads(leadsForExport);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=relatorio_leads_${new Date().toISOString().slice(0, 10)}.csv`);
      return res.status(200).send('\ufeff' + csvString); // Adiciona BOM para garantir UTF-8 no Excel

    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
      return res.status(500).json({ success: false, message: 'Erro interno ao gerar CSV.' });
    }
  }

  /**
   * Rota de Exportação PDF
   * @route POST /reports/export/pdf
   */
  static async exportPdf(req, res) {
    try {
      const filters = req.body.filters || req.query.filters || {};
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
      return res.status(200).send(pdfBuffer);
      
    } catch (error) {
       console.error('Erro ao exportar PDF (ReportController):', error.message);
       // Trata o erro 500 para evitar quebra total
       return res.status(500).json({ 
        success: false, 
        message: 'Erro interno ao gerar PDF. Verifique os logs do Puppeteer/Chromium se o erro persistir.' 
       });
    }
  }
}

module.exports = ReportController;