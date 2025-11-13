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
        const browser = await puppeteer.launch({ 
            headless: true,
            // Necessário em alguns ambientes como Render para encontrar o Chrome
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        const page = await browser.newPage();
        
        await page.setContent(htmlContent, {
             waitUntil: 'networkidle0' 
        });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' }
        });

        await browser.close();
        return pdfBuffer;
    }

    /**
     * Gera o conteúdo HTML completo do relatório com todas as métricas e leads.
     * @param {Object} data - Objeto contendo { metrics: { summary, productivity, funnel, lostReasons, ... }, leads, filters, generatorName }.
     * @returns {Promise<Buffer>} Buffer do arquivo PDF.
     */
    async generateFullReportPdf({ metrics, leads, filters, generatorName }) {
        const htmlContent = this.createReportHtml(metrics, leads, filters, generatorName);
        return this.generatePdf(htmlContent);
    }

    createReportHtml(metrics, leads, filters, generatorName) {
        // Formatação de números
        const formatKw = (kw) => Number(kw).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' kW';
        const formatPct = (pct) => Number(pct).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%';
        const formatDate = (date) => date ? new Date(date).toLocaleDateString('pt-BR') : 'N/A';
        const formatDays = (days) => Number(days).toFixed(1) + ' dias';
        const formatCurrency = (val) => 'R$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // --- 1. Resumo e KPIs ---
        const summaryHtml = `
            <h3>KPIs e Resumo Global</h3>
            <div class="kpis">
                <div><span>Total de Leads</span><p>${metrics.summary.totalLeads}</p></div>
                <div><span>Leads Ativos</span><p>${metrics.summary.activeLeads}</p></div>
                <div><span>Vendas (Qtd)</span><p>${metrics.summary.wonLeadsQty}</p></div>
                <div><span>Total Vendido</span><p>${formatKw(metrics.summary.totalKwWon)}</p></div>
                <div><span>Taxa de Conversão</span><p>${formatPct(metrics.summary.conversionRate)}</p></div>
                <div><span>T. Médio Fechamento</span><p>${formatDays(metrics.summary.avgTimeToWinDays)}</p></div>
                <div><span>Previsão Ponderada</span><p>${formatKw(metrics.forecasting.forecastedKwWeighted)}</p></div>
            </div>
        `;

        // --- 2. Tabela de Produtividade (Melhores Vendedores) ---
        const productivityRows = metrics.productivity.map(p => `
            <tr>
                <td>${p.vendorName}</td>
                <td>${p.totalLeadsPeriod}</td>
                <td>${p.wonLeadsQty}</td>
                <td>${formatKw(p.totalKwWon)}</td>
                <td>${formatPct(p.conversionRate)}</td>
                <td>${formatDays(p.avgTimeToWinDays)}</td>
            </tr>
        `).join('');

        const productivityHtml = `
            <h3>Produtividade do Vendedor (Top Performance)</h3>
            <table>
                <thead>
                    <tr>
                        <th>Vendedor</th>
                        <th>Leads no Período</th>
                        <th>Vendas (Qtd)</th>
                        <th>Vendas (kW)</th>
                        <th>Taxa de Conversão</th>
                        <th>T. Fechamento</th>
                    </tr>
                </thead>
                <tbody>${productivityRows}</tbody>
            </table>
        `;

        // --- 3. Tabela de Perdas (Churn) ---
        const lostReasonsRows = metrics.lostReasons.map(l => `
            <tr>
                <td>${l.reason}</td>
                <td>${l.count}</td>
                <td>${formatPct(l.percentage)}</td>
                <td>${formatKw(l.potentialKwLost)}</td>
            </tr>
        `).join('');

        const lostReasonsHtml = `
            <h3>Análise de Perdas (Churn)</h3>
            <table>
                <thead>
                    <tr>
                        <th>Motivo da Perda</th>
                        <th>Contagem</th>
                        <th>% Total Perda</th>
                        <th>kW Potenciais Perdidos</th>
                    </tr>
                </thead>
                <tbody>${lostReasonsRows}</tbody>
            </table>
        `;
        
        // --- 4. Tabela de Leads (Detalhes para Exportação) ---
        const leadsRows = leads.map(l => `
            <tr>
                <td>${l.name}</td>
                <td>${l.status}</td>
                <td>${l.origin}</td>
                <td>${l.owner_name}</td>
                <td>${formatKw(l.avg_consumption)}</td>
                <td>${l.reason_for_loss || 'N/A'}</td>
                <td>${formatDate(l.created_at)}</td>
            </tr>
        `).join('');

        const leadsHtml = `
            <h3>Detalhamento dos Leads (Filtro)</h3>
            <table>
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Status</th>
                        <th>Origem</th>
                        <th>Vendedor</th>
                        <th>Consumo (kW)</th>
                        <th>Motivo Perda</th>
                        <th>Criação</th>
                    </tr>
                </thead>
                <tbody>${leadsRows}</tbody>
            </table>
        `;

        // --- Estrutura HTML Final ---
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Relatório de Performance Completo</title>
                <style>
                    body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; padding: 0; color: #333; }
                    .header { background: #1A7F3C; color: white; padding: 20px; text-align: center; }
                    .report-container { padding: 30px; }
                    h1 { font-size: 18px; margin-bottom: 5px; }
                    h3 { font-size: 14px; color: #1A7F3C; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 20px; }
                    .filter-info { margin-bottom: 20px; font-size: 11px; color: #555; background: #f9f9f9; padding: 10px; border-radius: 5px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 25px; page-break-inside: auto; }
                    th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                    th { background-color: #f2f2f2; font-weight: bold; }
                    .kpis { display: flex; flex-wrap: wrap; margin-bottom: 30px; }
                    .kpis > div { width: 30%; margin: 10px 1.5%; padding: 10px; background: #f5f5f5; border-left: 3px solid #1A7F3C; }
                    .kpis span { display: block; font-size: 9px; color: #777; }
                    .kpis p { font-size: 14px; font-weight: bold; margin: 0; }
                    .footer { text-align: right; margin-top: 50px; font-size: 9px; color: #777; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Relatório de Performance | ${formatDate(filters.startDate)} a ${formatDate(filters.endDate)}</h1>
                </div>
                <div class="report-container">
                    <p class="filter-info">**Filtros Aplicados:** Vendedor: ${filters.ownerId || 'Todos'}, Origem: ${filters.source || 'Todas'}.</p>
                    
                    ${summaryHtml}
                    ${productivityHtml}
                    ${lostReasonsHtml}
                    
                    <div style="page-break-before: always;"></div>
                    ${leadsHtml}
                    
                    <p class="footer">Gerado por: ${generatorName} em: ${new Date().toLocaleString('pt-BR')}</p>
                </div>
            </body>
            </html>
        `;
    }
}

module.exports = new PdfGeneratorService();