// controllers/ReportController.js

const { pool } = require('../config/db');
const ReportDataService = require('../services/ReportDataService');
const CsvGeneratorService = require('../services/CsvGeneratorService'); 
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
     * @route POST /reports/data ou GET /reports/data
     */
    static async getReportData(req, res) {
        try {
            // Pega filtros do body (POST) ou da query (GET)
            const filters = req.body.filters || req.query || {}; 
            const userId = req.user?.id || null;
            const isAdmin = req.user?.role === 'Admin' || false;

            // 1. Busca os dados do dashboard baseados nos FILTROS
            const reportData = await ReportDataService.getAllDashboardData(filters, userId, isAdmin);

            // 2. CORREÇÃO: Busca o total de leads ativos global (SEM FILTROS)
            const globalActiveLeads = await ReportDataService.getGlobalActiveLeadsCount();

            // 3. Retorna os dados FILTRADOS mais o novo dado GLOBAL
            return res.status(200).json({ 
                success: true, 
                data: {
                    ...reportData,
                    globalActiveLeads // Novo campo para o Frontend (Barra Superior)
                }
            });
        } catch (error) {
            console.error('Erro ao buscar dados do relatório:', error);
            return res.status(500).json({ success: false, message: 'Erro ao buscar dados do relatório.', error: error.message });
        }
    }

    /**
     * Rota para buscar notas analíticas de um lead específico.
     * @route GET /reports/analytic/:leadId
     */
    static async getAnalyticNotes(req, res) {
        try {
            const { leadId } = req.params;
            // Assumindo que você tem um método no ReportDataService para isso
            // IMPORTANTE: Se esta função não existir, remova-a ou implemente no ReportDataService.
            const notes = await ReportDataService.getLeadAnalyticNotes(leadId); 
            return res.status(200).json({ success: true, data: notes });
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

            // Busca os leads brutos para exportação (usando filtros)
            const leadsForCsv = await ReportDataService.getLeadsForExport(filters, userId, isAdmin);
            
            // Gera o CSV
            const csvBuffer = await CsvGeneratorService.exportLeads(leadsForCsv);
            
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=relatorio_leads_${new Date().toISOString().slice(0, 10)}.csv`);
            return res.status(200).send(Buffer.from('\ufeff' + csvBuffer, 'utf8')); // Adiciona BOM para UTF-8 no Excel
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
            
            let message = 'Erro interno ao gerar PDF.';
            if (error.message.includes('Timeout') || error.message.includes('launch') || error.message.includes('executablePath')) {
                message = 'Falha crítica ao iniciar o navegador (Chromium) para o PDF. Verifique se o ambiente está configurado corretamente (Puppeteer).';
            }

            return res.status(500).json({ 
                success: false, 
                message: message, 
                error: error.message 
            });
        }
    }
}

module.exports = ReportController;