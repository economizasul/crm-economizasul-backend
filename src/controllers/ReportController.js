// controllers/ReportController.js

// O caminho correto deve subir um nível (para a raiz) e descer para 'src/services'
const ReportDataService = require('../../src/services/ReportDataService');

// Dependências de Exportação
const pdfKit = require('pdfkit');    
const ExcelJS = require('exceljs'); 

class ReportController {
    
    constructor() {
        // Conecta o 'this' de todos os métodos que serão usados como handlers de rota
        this.getReportData = this.getReportData.bind(this);
        this.getAnalyticNotes = this.getAnalyticNotes.bind(this);
        this.exportCsv = this.exportCsv.bind(this);
        this.exportPdf = this.exportPdf.bind(this);
    }
    
    // =============================================================
    // MÉTODOS DE DADOS (Não alterados, apenas adicionados ao constructor)
    // =============================================================
    
    async getReportData(req, res) {
        // ... (Seu código existente aqui)
        try {
            const { filters, userId, isAdmin } = req.body.context;
            const metrics = await ReportDataService.getDashboardMetrics(filters, userId, isAdmin);
            return res.status(200).json({ success: true, data: metrics });
        } catch (error) {
            console.error('Erro ao buscar dados do dashboard:', error);
            return res.status(500).json({ success: false, message: 'Erro interno ao buscar dados do dashboard.' });
        }
    }

    async getAnalyticNotes(req, res) {
        // ... (Seu código existente aqui)
        try {
            const { leadId } = req.query; 
            if (!leadId) return res.status(400).json({ success: false, message: 'ID do Lead é obrigatório.' });
            const data = await ReportDataService.getAnalyticNotes(leadId);
            if (!data) return res.status(404).json({ success: false, message: 'Lead não encontrado.' });
            return res.status(200).json({ success: true, data });
        } catch (error) {
            console.error('Erro ao buscar dados analíticos:', error);
            return res.status(500).json({ success: false, message: 'Erro interno ao buscar dados analíticos.' });
        }
    }
    
    // =============================================================
    // MÉTODOS DE EXPORTAÇÃO (Não alterados, apenas adicionados ao constructor)
    // =============================================================
    
    async exportCsv(req, res) {
        // ... (Seu código existente aqui)
        try {
            const filters = req.query;
            const userId = req.userId; 
            const isAdmin = req.isAdmin; 

            const allLeadsData = await ReportDataService.getAllLeadsForExport(filters, userId, isAdmin);
            // ... (Restante da lógica CSV)

            if (allLeadsData.length === 0) {
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

    async exportPdf(req, res) {
        // ... (Seu código existente aqui)
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

            // Implementação simplificada da tabela em PDFKit
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

            doc.end();

        } catch (error) {
            console.error('Erro na exportação PDF:', error);
            res.status(500).json({ success: false, message: 'Erro interno ao gerar o arquivo PDF.' });
        }
    }
}

// Exporta a INSTÂNCIA do Controller
module.exports = new ReportController();