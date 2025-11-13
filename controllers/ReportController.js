// controllers/ReportController.js
const { pool } = require('../config/db');
const ReportDataService = require('../services/ReportDataService');
// Assumindo que você tem serviços dedicados (GsvGeneratorService e PdfGeneratorService)
const CSVGeneratorService = require('../services/GsvGeneratorService'); 
const PDFGeneratorService = require('../services/PdfGeneratorService'); 

class ReportController {
  constructor() {
    this.getVendors = this.getVendors.bind(this);
    this.getReportData = this.getReportData.bind(this);
    this.getAnalyticNotes = this.getAnalyticNotes.bind(this);
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
      return res.status(500).json({ success: false, message: 'Erro ao buscar vendedores.', details: error.message });
    }
  }

  // Rota principal para buscar todos os dados do dashboard (FIX e Implementação)
  async getReportData(req, res) {
    try {
      const raw = req.body || req.query || {};

      const vendorId = raw.vendorId ?? raw.ownerId ?? raw.ownerid ?? raw.owner_id ?? null;
      const startDate = raw.startDate ?? raw.dateStart ?? null;
      const endDate = raw.endDate ?? raw.dateEnd ?? null;
      const source = raw.source ?? raw.sources ?? 'all';

      const filters = {
        startDate: startDate || null,
        endDate: endDate || null,
        source: source || 'all',
        ownerId: vendorId === undefined ? null : vendorId
      };

      const userId = req.user?.id ?? null;
      const isAdmin = req.user?.role === 'Admin';

      // 🚨 FIX CHAVE: Chama o método agregador que retorna todos os dados
      const metrics = await ReportDataService.getAllDashboardData(filters, userId, isAdmin); 
      
      return res.status(200).json({ success: true, data: metrics });

    } catch (error) {
      console.error('Erro ao buscar dados do dashboard (getReportData):', error);
      // Retornar um erro mais descritivo no log do servidor
      return res.status(500).json({ success: false, message: 'Erro interno ao buscar dados do dashboard. Verifique o ReportDataService.', details: error.message });
    }
  }

  // Rota para o NOVO Relatório Analítico de Atendimento
  async getAnalyticNotes(req, res) {
    try {
      // Recebe leadId (para histórico completo) ou stage (para leads ativos na fase)
      const { leadId } = req.params; 
      const { stage } = req.query; 

      // Permissão
      const userId = req.user?.id ?? null;
      const userRole = req.user?.role ?? 'User';

      // Chama o serviço que decide qual relatório buscar
      const analyticData = await ReportDataService.getAnalyticNotes(
          leadId, 
          stage, 
          userRole, 
          userId
      );

      return res.status(200).json({ success: true, data: analyticData });

    } catch (error) {
      console.error('Erro ao buscar dados analíticos de atendimento:', error);
      res.status(500).json({ success: false, message: 'Erro interno ao buscar notas analíticas.' });
    }
  }
  
  // Rota de Exportação CSV (Usando o serviço GsvGeneratorService)
  async exportCsv(req, res) {
    try {
      const filters = req.body.filters || req.query.filters || {};
      const userId = req.user?.id || null;
      const isAdmin = req.user?.role === 'Admin' || false;
      
      // Assumindo que este método existe no ReportDataService
      const dataToExport = await ReportDataService.getLeadsForExport(filters, userId, isAdmin);
      
      if (!dataToExport || dataToExport.length === 0) {
        return res.status(404).json({ success: false, message: 'Nenhum lead encontrado para exportação.' });
      }

      // 🚨 MUDANÇA: Delega a geração do CSV para o serviço
      const csvString = CSVGeneratorService.generateLeadsCsv(dataToExport);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=leads_report_${new Date().toISOString().slice(0, 10)}.csv`);
      res.status(200).send(csvString);

    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
      res.status(500).json({ success: false, message: 'Erro interno ao gerar CSV.' });
    }
  }

  // Rota de Exportação PDF (Usando o serviço PdfGeneratorService)
  async exportPdf(req, res) {
    try {
      const filters = req.body.filters || req.query.filters || {};
      const userId = req.user?.id || null;
      const isAdmin = req.user?.role === 'Admin' || false;

      // Busca todos os dados necessários (métricas e leads)
      const metrics = await ReportDataService.getAllDashboardData(filters, userId, isAdmin);
      const leadsForPdf = await ReportDataService.getLeadsForExport(filters, userId, isAdmin);
      
      // 🚨 MUDANÇA: Delega a geração do PDF para o serviço (melhor para layout e quebra de página)
      const pdfBuffer = await PDFGeneratorService.generateFullReportPdf({
          metrics, 
          leads: leadsForPdf, 
          filters,
          generatorName: req.user?.name || 'Admin',
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=relatorio_completo_${new Date().toISOString().slice(0, 10)}.pdf`);
      res.status(200).send(pdfBuffer);
      
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      res.status(500).json({ success: false, message: 'Erro interno ao gerar PDF. Verifique o PdfGeneratorService.' });
    }
  }
}

module.exports = new ReportController();