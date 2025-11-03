// controllers/ReportController.js (ATUALIZADO)

// O caminho foi corrigido na etapa 1.
const ReportDataService = require('../src/services/ReportDataService');
const CsvGeneratorService = require('../src/services/CsvGeneratorService');
const PdfGeneratorService = require('../src/services/PdfGeneratorService');
// ... (UserService e outras dependências)

class ReportController {
    // ... (getDashboardData e getAnalyticReport permanecem os mesmos)

    /**
     * Exporta os Leads ativos (filtrados) para um arquivo CSV.
     */
    async exportToCsv(req, res) {
        try {
            const filters = req.query;
            const userId = req.user.id;
            const isAdmin = UserService.isAdmin(userId);
            
            // 1. Coleta os leads brutos (usando o método auxiliar do ReportDataService)
            const conditions = ReportDataService._buildBaseConditions(filters, userId, isAdmin);
            const leadsToExport = await ReportDataService._getAllLeads(conditions); // Coleta leads
            
            // 2. Gera o CSV
            const csvString = await CsvGeneratorService.exportLeads(leadsToExport);
            
            // 3. Responde com o arquivo
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="relatorio_leads.csv"');
            return res.send(csvString);

        } catch (error) {
            console.error('Erro ao exportar CSV:', error);
            return res.status(500).json({ success: false, message: 'Erro interno na geração do CSV.' });
        }
    }

    /**
     * Gera e retorna um relatório em PDF.
     */
    async exportToPdf(req, res) {
        try {
            const filters = req.query;
            const userId = req.user.id;
            const isAdmin = UserService.isAdmin(userId);

            // 1. Coleta os dados agregados para o relatório
            const reportData = await ReportDataService.getDashboardMetrics(filters, userId, isAdmin);
            
            // 2. Constrói o HTML de impressão
            const htmlContent = PdfGeneratorService.buildReportHtml(reportData, filters);
            
            // 3. Gera o PDF
            const pdfBuffer = await PdfGeneratorService.generatePdf(htmlContent);

            // 4. Responde com o arquivo PDF
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="relatorio_gerencial.pdf"');
            return res.send(pdfBuffer);
            
        } catch (error) {
            console.error('Erro ao exportar PDF:', error);
            return res.status(500).json({ success: false, message: 'Erro interno na geração do PDF.' });
        }
    }
}

module.exports = new ReportController();