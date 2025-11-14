// controllers/ReportController.js (CORREÇÃO FINAL PARA DEPLOY)
const { pool } = require('../config/db');
const ReportDataService = require('../services/ReportDataService');
const CsvGeneratorService = require('../services/CsvGeneratorService'); 
const PdfGeneratorService = require('../services/PdfGeneratorService'); 

// 🚨 CORREÇÃO DE DEPLOY: A linha abaixo estava causando o erro "Cannot find module"
// const LeadAnalyticNote = require('../models/LeadAnalyticNote'); // LINHA REMOVIDA OU COMENTADA

class ReportController {
  constructor() {
    // Certifique-se de que o bind está usando a sintaxe correta para classes
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
      
      // 🚨 CORREÇÃO CRÍTICA: Trata filtros que vêm como string na URL (GET)
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
      console.error('ERRO INTERNO: ReportController.getReportData falhou:', error.message);
      return res.status(500).json({ 
        success: false, 
        message: 'Falha ao carregar dados do relatório. Verifique o log do servidor para o erro SQL detalhado.' 
      });
    }
  }
  
  /**
   * Rota para buscar notas analíticas de um Lead específico.
   * (Esta função agora retorna um array vazio para não depender do módulo LeadAnalyticNote)
   * @route GET /reports/analytic/:leadId
   */
  static async getAnalyticNotes(req, res) {
    try {
        const { leadId } = req.params;
        // 🚨 Placeholder temporário para funcionar sem o modelo LeadAnalyticNote
        // Se este módulo for implementado, a lógica de busca deve ser adicionada aqui.
        console.warn(`Função getAnalyticNotes chamada para lead ${leadId}. Retornando placeholder.`);
        return res.status(200).json({ success: true, data: [] }); 
    } catch (error) {
        console.error('Erro ao buscar notas analíticas:', error);
        return res.status(500).json({ success: false, message: 'Erro ao buscar notas analíticas.' });
    }
  }

  /**
   * Rota de Exportação CSV
   * @route POST/GET /reports/export/csv
   */
  static async exportCsv(req, res) {
    try {
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

  /**
   * Rota de Exportação PDF
   * @route POST/GET /reports/export/pdf
   */
  static async exportPdf(req, res) {
    try {
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
        message = 'Falha crítica ao iniciar o navegador (Chromium) para o PDF. Verifique as dependências do Render.';
       }

       return res.status(500).json({ 
        success: false, 
        message: message 
       });
    }
  }
}

module.exports = ReportController;