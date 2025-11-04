// src/services/PdfGeneratorService.js

const puppeteer = require('puppeteer');
// Nota: Certifique-se de instalar 'puppeteer' e que seu ambiente Render o suporte (headless Chrome)

class PdfGeneratorService {

    /**
     * Gera um PDF a partir de um conteúdo HTML.
     * @param {string} htmlContent - Conteúdo HTML do relatório.
     * @returns {Promise<Buffer>} Buffer do arquivo PDF.
     */
    async generatePdf(htmlContent) {
        // Renderização no Backend é mais estável para relatórios complexos.
        const browser = await puppeteer.launch({ 
            headless: true,
            // Necessário em alguns ambientes como Render para encontrar o Chrome
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        const page = await browser.newPage();
        
        // Define o conteúdo HTML na página
        await page.setContent(htmlContent, {
             waitUntil: 'networkidle0' // Espera o carregamento de imagens/estilos
        });

        // Configurações de impressão
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' }
            // Você pode adicionar cabeçalhos/rodapés aqui
        });

        await browser.close();
        return pdfBuffer;
    }

    /**
     * Cria um HTML básico para a impressão (deve ser aprimorado com seus estilos).
     * @param {Object} data - Dados formatados para o relatório (do ReportDataService).
     * @param {Object} filters - Filtros aplicados.
     */
    buildReportHtml(data, filters) {
        // **Este HTML é MUITO SIMPLIFICADO. O ideal é usar um template engine (Ex: Handlebars)
        // e um CSS específico para impressão (@media print).**
        
        const productivityRows = `
            <tr><td>Leads Ativos</td><td>${data.productivity.leadsActive}</td></tr>
            <tr><td>Vendas (Contagem)</td><td>${data.productivity.totalWonCount}</td></tr>
            <tr><td>Valor de Vendas (R$)</td><td>R$ ${data.productivity.totalWonValue}</td></tr>
            <tr><td>Taxa de Conversão</td><td>${data.productivity.conversionRate}</td></tr>
            <tr><td>Tempo Médio Fechamento</td><td>${data.productivity.avgClosingTimeDays} dias</td></tr>
        `;

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Relatório Gerencial</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
                    .header { background: #007BFF; color: white; padding: 20px; text-align: center; }
                    .report-container { padding: 40px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .filter-info { margin-bottom: 20px; font-size: 0.9em; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Relatório de Performance - Energia Solar</h1>
                </div>
                <div class="report-container">
                    <p class="filter-info">**Filtros Aplicados:** Vendedor: ${filters.vendorId || 'Todos'}, Período: ${filters.periodStart} a ${filters.periodEnd}.</p>
                    
                    <h2>Métricas de Produtividade</h2>
                    <table>
                        <thead>
                            <tr><th>Métrica</th><th>Valor</th></tr>
                        </thead>
                        <tbody>
                            ${productivityRows}
                        </tbody>
                    </table>

                    <p style="text-align: right; margin-top: 50px;">Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
                </div>
            </body>
            </html>
        `;
    }
}

module.exports = new PdfGeneratorService();