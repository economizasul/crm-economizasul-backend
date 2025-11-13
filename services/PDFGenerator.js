// services/PdfGeneratorService.js

// 🚨 CORREÇÃO: Usando puppeteer-core e o binário compatível com Render
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium'); 

class PdfGeneratorService {

    /**
     * Gera um PDF a partir de um conteúdo HTML. (Garantindo args para Render)
     * @param {string} htmlContent - Conteúdo HTML do relatório.
     * @returns {Promise<Buffer>} Buffer do arquivo PDF.
     */
    async generatePdf(htmlContent) {
        // Configuração de lançamento do navegador para ambientes como Render/AWS Lambda
        const browser = await puppeteer.launch({ 
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(), // Usa o caminho do binário compatível
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });
        
        const page = await browser.newPage();
        
        await page.setContent(htmlContent, {
             waitUntil: 'networkidle0'
        });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '1in', right: '0.8in', bottom: '0.8in', left: '0.8in' }
        });

        await browser.close();
        return pdfBuffer;
    }

    /**
     * Gera o HTML completo do relatório.
     * ... (O restante do código HTML é o mesmo, mantido por brevidade)
     */
    generateHtmlReport({ metrics, leads, filters, generatorName }) {
        // Fallback e desestruturação segura
        const { productivity = {}, funnel = [], lostReasons = {} } = metrics || {};

        // ==========================================================
        // UTILS DE FORMATAÇÃO
        // ==========================================================
        const formatKw = (value) => value ? `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} KW` : '0 KW';
        const formatPercent = (value) => value ? `${(value * 100).toFixed(1).replace('.', ',')}%` : '0%';
        const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('pt-BR') : 'N/A';
        const formatDays = (value) => value ? `${Number(value).toFixed(1).replace('.', ',')} dias` : 'N/A';
        
        // ==========================================================
        // 1. SEÇÃO DE PRODUTIVIDADE E KPIS
        // ==========================================================
        const productivityMetrics = [
            { label: 'Leads Ativos', value: productivity.leadsActive?.toLocaleString('pt-BR') || '0' },
            { label: 'Total de Leads Criados', value: productivity.totalLeads?.toLocaleString('pt-BR') || '0' },
            { label: 'Vendas (Qtd)', value: productivity.totalWonCount?.toLocaleString('pt-BR') || '0' },
            { label: 'Vendas (KW)', value: formatKw(productivity.totalWonValueKW) },
            { label: 'Taxa de Conversão', value: formatPercent(productivity.conversionRate) },
            { label: 'Taxa de Perda (Loss Rate)', value: formatPercent(productivity.lossRate) },
            { label: 'Tempo Médio de Fechamento', value: formatDays(productivity.avgClosingTimeDays) },
        ];
        
        const productivityRows = productivityMetrics.map(m => `
            <tr>
                <td>${m.label}</td>
                <td class="value">${m.value}</td>
            </tr>
        `).join('');

        // ==========================================================
        // 2. SEÇÃO DE FUNIL DE VENDAS
        // ==========================================================
        const totalLeadsFunnel = funnel.reduce((sum, s) => sum + s.count, 0);

        const funnelRows = funnel && funnel.length > 0
            ? funnel.map(stage => {
                const percentage = totalLeadsFunnel > 0 ? (stage.count / totalLeadsFunnel) * 100 : 0;
                return `
                    <tr>
                        <td>${stage.stageName}</td>
                        <td class="value">${stage.count.toLocaleString('pt-BR')}</td>
                        <td class="value">${percentage.toFixed(1).replace('.', ',')}%</td>
                    </tr>
                `;
            }).join('')
            : '<tr><td colspan="3">Nenhum dado de funil encontrado.</td></tr>';

        // ==========================================================
        // 3. SEÇÃO DE MOTIVOS DE PERDA
        // ==========================================================
        const totalLost = lostReasons.totalLost || 0;
        const lostReasonsRows = lostReasons.reasons && lostReasons.reasons.length > 0
            ? lostReasons.reasons.map(item => {
                const percentage = (item.count / totalLost) * 100;
                return `
                    <tr>
                        <td>${item.reason || 'Não Especificado'}</td>
                        <td class="value">${item.count.toLocaleString('pt-BR')}</td>
                        <td class="value">${percentage.toFixed(1).replace('.', ',')}%</td>
                    </tr>
                `;
            }).join('')
            : `<tr><td colspan="3">Nenhum lead perdido no período. (Total de Perdidos: ${totalLost})</td></tr>`;


        // ==========================================================
        // 4. SEÇÃO DE LEADS DETALHADOS (Tabela Principal)
        // ==========================================================
        const leadsTableHeaders = `
            <thead>
                <tr class="header-row">
                    <th>ID</th>
                    <th>Nome</th>
                    <th>Status</th>
                    <th>Proprietário</th>
                    <th>Origem</th>
                    <th>KW Estimado</th>
                    <th>Criado em</th>
                </tr>
            </thead>
        `;
        
        const leadsTableRows = leads && leads.length > 0
            ? leads.map(lead => `
                <tr>
                    <td>${lead.id}</td>
                    <td>${lead.name}</td>
                    <td>${lead.status}</td>
                    <td>${lead.owner_name || 'N/A'}</td>
                    <td>${lead.origin || 'N/A'}</td>
                    <td>${formatKw(lead.avg_consumption)}</td>
                    <td>${formatDate(lead.created_at)}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="7">Nenhum lead encontrado com os filtros aplicados.</td></tr>';
        
        // ==========================================================
        // TEMPLATE HTML FINAL
        // ==========================================================
        return `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>Relatório de Performance - EconomizaSul</title>
                <style>
                    body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; background-color: #f7f9fb; font-size: 10pt; }
                    .header { background: #1A7F3C; color: white; padding: 25px 40px; text-align: center; border-bottom: 5px solid #0F5E2B; }
                    .header h1 { margin: 0; font-size: 20pt; }
                    .report-container { padding: 30px 40px; }
                    h2 { color: #1A7F3C; border-bottom: 2px solid #eee; padding-bottom: 5px; margin-top: 25px; font-size: 16pt; }
                    h3 { color: #555; margin-top: 20px; font-size: 13pt; }
                    .filter-info { background-color: #f0f8ff; border: 1px solid #cceeff; padding: 10px; margin-bottom: 25px; font-size: 10pt; border-radius: 5px; }
                    .filter-info p { margin: 3px 0; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th, td { border: 1px solid #ddd; padding: 10px 12px; text-align: left; }
                    th { background-color: #e8e8e8; color: #333; font-weight: bold; font-size: 9pt; }
                    .value { text-align: right; font-weight: bold; }
                    .summary-box { background-color: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 20px; }
                    .section-break { page-break-before: always; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Relatório de Performance & Métricas</h1>
                    <p style="font-size: 10pt; margin-top: 5px;">Sistema CRM - EconomizaSul</p>
                </div>
                <div class="report-container">
                    
                    <div class="filter-info">
                        <h3>Informações do Relatório</h3>
                        <p><strong>Gerado por:</strong> ${generatorName}</p>
                        <p><strong>Período:</strong> ${filters.startDate} a ${filters.endDate}</p>
                        <p><strong>Vendedor:</strong> ${filters.ownerId === 'all' ? 'Todos' : filters.ownerId}</p>
                        <p><strong>Origem:</strong> ${filters.source === 'all' ? 'Todas' : filters.source}</p>
                    </div>

                    <h2>Métricas de Produtividade (KPIs)</h2>
                    <div class="summary-box">
                        <table>
                            ${productivityRows}
                        </table>
                    </div>

                    <div style="display: flex; justify-content: space-between;">
                        <div style="width: 48%;" class="summary-box">
                            <h2>Funil de Vendas</h2>
                            <table>
                                <thead>
                                    <tr class="header-row"><th>Etapa</th><th>Qtd. Leads</th><th>% Total</th></tr>
                                </thead>
                                ${funnelRows}
                            </table>
                        </div>
                        <div style="width: 48%;" class="summary-box">
                            <h2>Motivos de Perda (Churn)</h2>
                            <table>
                                <thead>
                                    <tr class="header-row"><th>Motivo</th><th>Qtd. Perda</th><th>% da Perda</th></tr>
                                </thead>
                                ${lostReasonsRows}
                            </table>
                        </div>
                    </div>
                    
                    <div class="section-break"></div>

                    <h2>Leads Detalhados (${leads ? leads.length.toLocaleString('pt-BR') : 0})</h2>
                    <table>
                        ${leadsTableHeaders}
                        <tbody>
                            ${leadsTableRows}
                        </tbody>
                    </table>

                    <p style="text-align: right; margin-top: 50px; font-size: 9pt;">
                        Relatório gerado em ${new Date().toLocaleString('pt-BR')}.
                    </p>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Função principal chamada pelo ReportController para gerar o PDF completo.
     * @param {Object} data - Objeto contendo todos os dados necessários.
     * @returns {Promise<Buffer>} Buffer do PDF.
     */
    async generateFullReportPdf(data) {
        const htmlContent = this.generateHtmlReport(data);
        return this.generatePdf(htmlContent);
    }
}

module.exports = new PdfGeneratorService();