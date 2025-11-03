// controllers/ReportController.js

// O caminho foi corrigido para buscar dentro de /src/services
const ReportDataService = require('../src/services/ReportDataService');
const CsvGeneratorService = require('../src/services/CsvGeneratorService');
const PdfGeneratorService = require('../src/services/PdfGeneratorService');

// =============================================================
// ATENÇÃO: SIMULAÇÃO DA DEPENDÊNCIA
// Você deve substituir esta SIMULAÇÃO pelo seu UserService real, 
// ou garantir que ele esteja definido e exportado em outro lugar.
// A função is_admin_check simula a permissão de ver relatórios de todos.
// =============================================================
const UserService = { 
    // Mapeia o campo 'relatorios_todos' do req.user para isAdmin
    isAdmin: (user) => user?.relatorios_todos === true
};

class ReportController {

    /**
     * Retorna os dados para o dashboard de relatórios (gráficos e tabelas).
     */
    async getDashboardData(req, res) {
        try {
            const filters = req.query;
            const userId = req.user.id;
            const isAdmin = UserService.isAdmin(req.user); // Usa o objeto req.user
            
            const data = await ReportDataService.getDashboardMetrics(filters, userId, isAdmin);

            return res.json({ success: true, data });
        } catch (error) {
            console.error('Erro ao buscar dados do dashboard:', error.message);
            // É importante retornar uma resposta de erro consistente
            return res.status(500).json({ success: false, message: 'Erro interno ao processar relatórios.' });
        }
    }

    /**
     * Retorna os dados para o relatório analítico de atendimento de um lead.
     */
    async getAnalyticReport(req, res) {
        try {
            const { leadId } = req.query;
            if (!leadId) {
                return res.status(400).json({ success: false, message: 'ID do Lead é obrigatório.' });
            }

            const report = await ReportDataService.getAnalyticNotes(leadId);
            
            if (!report) {
                 return res.status(404).json({ success: false, message: 'Lead não encontrado.' });
            }

            // REQUISIÇÃO DE PERMISSÃO: Se não for admin E o lead não for dele, nega o acesso.
            const isAdmin = UserService.isAdmin(req.user);
            if (!isAdmin && report.leadInfo.ownerId !== req.user.id) {
                return res.status(403).json({ success: false, message: 'Acesso negado. Você só pode ver seus próprios leads.' });
            }

            return res.json({ success: true, data: report });
        } catch (error) {
             console.error('Erro ao buscar relatório analítico:', error.message);
             return res.status(500).json({ success: false, message: 'Erro interno ao buscar dados.' });
        }
    }
    
    /**
     * Exporta os Leads ativos (filtrados) para um arquivo CSV.
     */
    async exportToCsv(req, res) {
        try {
            const filters = req.query;
            const userId = req.user.id;
            const isAdmin = UserService.isAdmin(req.user); 
            
            // 1. Coleta os leads brutos 
            const conditions = ReportDataService._buildBaseConditions(filters, userId, isAdmin);
            const leadsToExport = await ReportDataService._getAllLeads(conditions); 
            
            // 2. Gera o CSV
            const csvString = await CsvGeneratorService.exportLeads(leadsToExport);
            
            // 3. Responde com o arquivo
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="relatorio_leads.csv"');
            return res.send(csvString);

        } catch (error) {
            console.error('Erro ao exportar CSV:', error.message);
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
            const isAdmin = UserService.isAdmin(req.user); 

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
            console.error('Erro ao exportar PDF:', error.message);
            return res.status(500).json({ success: false, message: 'Erro interno na geração do PDF.' });
        }
    }
}

// OBRIGATÓRIO: Exportar a INSTÂNCIA
module.exports = new ReportController();