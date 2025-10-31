// src/services/PDFGenerator.js
const PDFDocument = require('pdfkit');
const getStream = require('get-stream');
const { stringify } = require('csv-stringify');

// --- Helper para PDF ---

/**
 * Cria o HTML/Formato visual do relatório PDF.
 * @param {Array} data - Dados detalhados dos leads para inclusão no relatório.
 * @param {Object} filters - Filtros usados para o relatório.
 * @returns {Buffer} Buffer do PDF.
 */
exports.generatePdfReport = async (data, filters) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // Header
    doc.fontSize(20).text('Relatório de Leads (ECONOMIZASUL)', { align: 'center' });
    doc.fontSize(10).text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} | Filtros: Vendedor: ${filters.ownerId || 'Todos'} | Período: ${filters.startDate || 'Todo'}\n\n`, { align: 'center' });
    
    // Tabela de Dados (Simplificada - para um PDF real, você usaria uma lógica mais complexa de layout de tabela)
    doc.fontSize(12).text(`Total de Leads Exportados: ${data.length}`, { continued: false }).moveDown(0.5);
    
    const tableHeaders = ['ID', 'Nome', 'Status', 'Origem', 'Vendedor', 'Data Criação', 'Valor Proposta (R$)'];
    const colWidths = [30, 100, 70, 70, 70, 60, 100]; // Ajuste conforme necessário

    let yPosition = doc.y;
    
    // Desenha Cabeçalho da Tabela
    doc.fillColor('#444444').fontSize(8);
    let currentX = doc.page.margins.left;
    tableHeaders.forEach((header, i) => {
        doc.text(header, currentX, yPosition, { width: colWidths[i], align: 'left' });
        currentX += colWidths[i];
    });
    doc.moveDown(0.5);
    
    // Desenha Linhas de Dados
    data.forEach((lead) => {
        yPosition = doc.y;
        currentX = doc.page.margins.left;
        
        // Verifica se há espaço para a linha, se não houver, adiciona uma nova página
        if (yPosition + 20 > doc.page.height - doc.page.margins.bottom) {
            doc.addPage();
            yPosition = doc.page.margins.top + 30; // Pula o header
            doc.fillColor('#444444').fontSize(8);
            let tempX = doc.page.margins.left;
            tableHeaders.forEach((header, i) => {
                 doc.text(header, tempX, yPosition, { width: colWidths[i], align: 'left' });
                 tempX += colWidths[i];
            });
            doc.moveDown(0.5);
            yPosition = doc.y;
            currentX = doc.page.margins.left;
        }

        doc.fillColor('#000000').fontSize(8);
        doc.text(lead.id.toString(), currentX, yPosition, { width: colWidths[0], align: 'left' });
        currentX += colWidths[0];
        doc.text(lead.name || 'N/A', currentX, yPosition, { width: colWidths[1], align: 'left' });
        currentX += colWidths[1];
        doc.text(lead.status || 'N/A', currentX, yPosition, { width: colWidths[2], align: 'left' });
        currentX += colWidths[2];
        doc.text(lead.origin || 'N/A', currentX, yPosition, { width: colWidths[3], align: 'left' });
        currentX += colWidths[3];
        doc.text(lead.owner_name || 'N/A', currentX, yPosition, { width: colWidths[4], align: 'left' });
        currentX += colWidths[4];
        doc.text(new Date(lead.created_at).toLocaleDateString('pt-BR'), currentX, yPosition, { width: colWidths[5], align: 'left' });
        currentX += colWidths[5];
        doc.text((lead.estimated_savings || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }), currentX, yPosition, { width: colWidths[6], align: 'right' });
        currentX += colWidths[6];
        
        doc.moveDown(0.5); // Espaçamento entre linhas
    });

    doc.end();
    
    // Retorna o buffer completo do documento
    return getStream.buffer(doc);
};


// --- Helper para CSV ---

/**
 * Cria a string CSV a partir dos dados.
 * @param {Array} data - Dados detalhados dos leads.
 * @returns {Promise<string>} String formatada em CSV.
 */
exports.generateCsvString = async (data) => {
    // Mapear os dados para garantir que a ordem e os campos sejam claros
    const records = data.map(lead => ({
        ID: lead.id,
        Nome: lead.name,
        Email: lead.email,
        Telefone: lead.phone,
        Status: lead.status,
        Origem: lead.origin,
        Vendedor: lead.owner_name,
        'Data Criação': new Date(lead.created_at).toLocaleDateString('pt-BR'),
        'Valor Proposta (R$)': lead.estimated_savings,
        'Motivo Perda': lead.reason_for_loss || '',
        'Data Ganho': lead.date_won ? new Date(lead.date_won).toLocaleDateString('pt-BR') : ''
    }));

    // Configuração para o stringify
    const stringifier = stringify({ header: true, delimiter: ';' });
    
    let csvString = '';
    
    for (const record of records) {
        csvString += stringifier.write(record);
    }
    stringifier.end();

    // Promessa para pegar todo o conteúdo
    const output = await getStream(stringifier);
    return output;
};