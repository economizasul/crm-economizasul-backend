// controllers/ReportController.js

// CORRIGIDO: Caminho para ReportDataService ajustado para estrutura na raiz
const ReportDataService = require('../services/ReportDataService');

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
    // MÉTODOS DE DADOS
    // =============================================================
    
    async getReportData(req, res) {
        try {
            const { filters, userId, isAdmin } = req.body.context;
            const metrics = await ReportDataService.getDashboardMetrics(filters, userId, isAdmin);
            return res.status(200).json({ success: true, data: metrics });
        } catch (error) {
            console.error('Erro ao buscar dados do dashboard:', error);
            return res.status(500).json({ success: false, message: 'Erro interno do servidor ao buscar métricas.' });
        }
    }
    
    async getAnalyticNotes(req, res) {
        try {
            const { filters, userId, isAdmin } = req.body.context;
            const notes = await ReportDataService.getAnalyticNotes(filters, userId, isAdmin);
            return res.status(200).json({ success: true, data: notes });
        } catch (error) {
            console.error('Erro ao buscar notas analíticas:', error);
            return res.status(500).json({ success: false, message: 'Erro interno do servidor ao buscar notas.' });
        }
    }


    // =============================================================
    // MÉTODOS DE EXPORTAÇÃO
    // =============================================================

    async exportCsv(req, res) {
        try {
            const { filters, userId, isAdmin } = req.body.context;
            const leadData = await ReportDataService.getLeadsForExport(filters, userId, isAdmin);

            // 1. Configurações básicas
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Leads Report');

            // 2. Definir Colunas (adaptado para o formato snake_case que o ReportDataService retorna)
            worksheet.columns = [
                { header: 'ID', key: 'id', width: 10 },
                { header: 'Nome', key: 'name', width: 30 },
                { header: 'Telefone', key: 'phone', width: 20 },
                { header: 'E-mail', key: 'email', width: 30 },
                { header: 'Documento', key: 'document', width: 20 },
                { header: 'Endereço', key: 'address', width: 40 },
                { header: 'Status', key: 'status', width: 15 },
                { header: 'Origem', key: 'origin', width: 15 },
                { header: 'Proprietário', key: 'owner_name', width: 20 },
                { header: 'UC', key: 'uc', width: 15 },
                { header: 'Consumo Médio', key: 'avg_consumption', width: 15 },
                { header: 'Economia Estimada', key: 'estimated_savings', width: 15 },
                { header: 'QSA', key: 'qsa', width: 30 },
                { header: 'Notas', key: 'notes', width: 50 },
                { header: 'Latitude', key: 'lat', width: 15 },
                { header: 'Longitude', key: 'lng', width: 15 },
                { header: 'Criado em', key: 'created_at', width: 20 },
                { header: 'Atualizado em', key: 'updated_at', width: 20 }
            ];

            // 3. Adicionar Dados
            worksheet.addRows(leadData.map(lead => ({
                id: lead.id,
                name: lead.name,
                phone: lead.phone,
                email: lead.email || '',
                document: lead.document || '',
                address: lead.address || '',
                status: lead.status,
                origin: lead.origin,
                owner_name: lead.owner_name || 'Desconhecido',
                uc: lead.uc || '',
                avg_consumption: lead.avg_consumption || 0,
                estimated_savings: lead.estimated_savings || 0,
                qsa: lead.qsa || '',
                notes: lead.notes || '',
                lat: lead.lat || '',
                lng: lead.lng || '',
                created_at: lead.created_at ? new Date(lead.created_at).toLocaleString('pt-BR') : '',
                updated_at: lead.updated_at ? new Date(lead.updated_at).toLocaleString('pt-BR') : ''
            })));

            // 4. Configurar cabeçalhos da resposta
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=leads_report_${new Date().toISOString().slice(0, 10)}.xlsx`);

            // 5. Enviar o arquivo
            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            console.error('Erro ao exportar CSV:', error);
            res.status(500).json({ error: "Erro interno do servidor ao exportar CSV." });
        }
    }

    async exportPdf(req, res) {
        try {
            const { filters, userId, isAdmin } = req.body.context;
            const prod = await ReportDataService.getDashboardMetrics(filters, userId, isAdmin);

            // 1. Configurações básicas do PDF
            const doc = new pdfKit();
            const buffers = [];
            
            // Captura o conteúdo do PDF
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=relatorio_crm_${new Date().toISOString().slice(0, 10)}.pdf`);
                res.send(pdfData);
            });

            // 2. Conteúdo do PDF
            doc.fontSize(25).text('Relatório de Desempenho do CRM', 50, 50);
            doc.fontSize(12).text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 50, 80);
            doc.moveDown();
            
            doc.fontSize(16).text('Principais Métricas:', 50, 120);
            doc.moveDown();

            // Dados da Tabela
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
            console.error('Erro ao exportar PDF:', error);
            res.status(500).json({ error: "Erro interno do servidor ao exportar PDF." });
        }
    }
}

module.exports = new ReportController();