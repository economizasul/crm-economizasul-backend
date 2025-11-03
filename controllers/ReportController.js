// controllers/ReportController.js

// O caminho correto deve subir um nível (para a raiz) e descer para 'src/services'
// Dependendo da sua estrutura exata, se 'src' estiver na raiz, este é o caminho:
const ReportDataService = require('../src/services/ReportDataService');

// Dependências de Exportação (Certifique-se de que estão instaladas via npm)
const pdfKit = require('pdfkit');    
const ExcelJS = require('exceljs'); 
// Nota: O método .table do pdfKit pode precisar de um módulo auxiliar em produção. 
// O código abaixo é ilustrativo do fluxo.

class ReportController {
    
    /**
     * @route GET /api/reports/data
     * Retorna todas as métricas agregadas do dashboard com base nos filtros.
     */
    async getReportData(req, res) {
        try {
            const { filters, userId, isAdmin } = req.body.context; // Assumindo que o contexto é injetado no corpo ou é um middleware
            
            const metrics = await ReportDataService.getDashboardMetrics(filters, userId, isAdmin);
            
            return res.status(200).json({ 
                success: true, 
                data: metrics 
            });

        } catch (error) {
            console.error('Erro ao buscar dados do dashboard:', error);
            return res.status(500).json({ success: false, message: 'Erro interno ao buscar dados do dashboard.' });
        }
    }

    /**
     * @route GET /api/reports/analytic
     * Retorna os dados analíticos e anotações para um lead específico.
     */
    async getAnalyticNotes(req, res) {
        try {
            const { leadId } = req.query; 

            if (!leadId) {
                return res.status(400).json({ success: false, message: 'ID do Lead é obrigatório.' });
            }

            const data = await ReportDataService.getAnalyticNotes(leadId);

            if (!data) {
                return res.status(404).json({ success: false, message: 'Lead não encontrado.' });
            }

            return res.status(200).json({ success: true, data });

        } catch (error) {
            console.error('Erro ao buscar dados analíticos:', error);
            return res.status(500).json({ success: false, message: 'Erro interno ao buscar dados analíticos.' });
        }
    }

    /**
     * @route GET /api/reports/export/csv
     * Exporta os dados brutos de leads para CSV (usando req.query para filtros em GET).
     */
    async exportCsv(req, res) {
        try {
            // Usa req.query para filtros, e assume que userId/isAdmin virão de middleware
            const filters = req.query;
            const userId = req.userId; // Middleware deve injetar isso
            const isAdmin = req.isAdmin; // Middleware deve injetar isso

            const allLeadsData = await ReportDataService.getAllLeadsForExport(filters, userId, isAdmin);

            if (allLeadsData.length === 0) {
                // Não retorna 404, mas sim um CSV vazio ou com mensagem de erro
                return res.status(200).send('ID,Nome,Estágio,Valor,Origem,Vendedor,Data Criação\n');
            }

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Relatório de Leads');
            
            worksheet.columns = [
                { header: 'ID', key: 'id', width: 10 },
                { header: 'Nome', key: 'name', width: 30 },
                { header: 'Estágio', key: 'stage', width: 20 },
                { header: 'Valor', key: 'value', width: 15, style: { numFmt: '"R$"#,##0.00' } },
                { header: 'Origem', key: 'source', width: 20 },
                { header: 'Vendedor', key: 'ownerName', width: 25 },
                { header: 'Data Criação', key: 'createdAt', width: 20, style: { numFmt: 'yyyy-mm-dd hh:mm:ss' } },
            ];

            worksheet.addRows(allLeadsData);

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="relatorio_leads.csv"');

            await workbook.csv.write(res);
            res.end();

        } catch (error) {
            console.error('Erro na exportação CSV:', error);
            res.status(500).json({ success: false, message: 'Erro interno ao gerar o arquivo CSV.' });
        }
    }

    /**
     * @route GET /api/reports/export/pdf
     * Exporta o resumo das métricas (Productivity e Forecast) para PDF (usando req.query para filtros em GET).
     */
    async exportPdf(req, res) {
        try {
            const filters = req.query;
            const userId = req.userId; 
            const isAdmin = req.isAdmin;

            const metrics = await ReportDataService.getDashboardMetrics(filters, userId, isAdmin);
            
            const doc = new pdfKit();
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="relatorio_resumo.pdf"');
            
            doc.pipe(res); 

            // --- Conteúdo do PDF ---
            doc.fontSize(18).text('Relatório de Desempenho do CRM', { align: 'center' }).moveDown();
            
            // 1. Previsão
            doc.fontSize(14).text('📈 Previsão de Vendas (Forecast)').moveDown(0.5);
            doc.fontSize(12).text(`Valor Ponderado: R$ ${metrics.salesForecast.weightedValue.toFixed(2).replace('.', ',')}`).moveDown(0.2);
            doc.fontSize(12).text(`Valor Total no Funil: R$ ${metrics.salesForecast.totalValue.toFixed(2).replace('.', ',')}`).moveDown(1);
            
            // 2. Produtividade
            doc.fontSize(14).text('📊 Métricas de Produtividade').moveDown(0.5);
            
            const prod = metrics.productivity;
            const tableData = [
                ['Métrica', 'Valor'],
                ['Leads Ativos', prod.leadsActive.toLocaleString('pt-BR')],
                ['Vendas Concluídas (Qtd)', prod.totalWonCount.toLocaleString('pt-BR')],
                ['Valor Total de Vendas', `R$ ${prod.totalWonValue.toFixed(2).replace('.', ',')}`],
                ['Taxa de Conversão', `${(prod.conversionRate * 100).toFixed(2).replace('.', ',')}%`],
                ['Taxa de Perda', `${(prod.lossRate * 100).toFixed(2).replace('.', ',')}%`],
                ['Tempo Médio de Fechamento', `${prod.avgClosingTimeDays.toFixed(1)} dias`],
            ];

            // Implementação simplificada da tabela em PDFKit (pode precisar de um módulo wrapper)
            let yPosition = doc.y;
            doc.font('Helvetica-Bold');
            doc.text(tableData[0][0], 50, yPosition, { width: 250 });
            doc.text(tableData[0][1], 350, yPosition);
            yPosition += 20;

            doc.font('Helvetica');
            for (let i = 1; i < tableData.length; i++) {
                doc.text(tableData[i][0], 50, yPosition, { width: 250 });
                doc.text(tableData[i][1], 350, yPosition);
                yPosition += 15;
            }

            // -- Fim do Conteúdo --
            doc.end();

        } catch (error) {
            console.error('Erro na exportação PDF:', error);
            res.status(500).json({ success: false, message: 'Erro interno ao gerar o arquivo PDF.' });
        }
    }
}

module.exports = new ReportController();