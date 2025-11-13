// services/CsvGeneratorService.js
const { stringify } = require('csv-stringify'); 

class CsvGeneratorService {
    /**
     * Converte um array de objetos em uma string CSV.
     * @param {Array<Object>} data - Dados para exportar.
     * @param {string[]} columns - Array de nomes de colunas na ordem desejada.
     * @returns {Promise<string>} String formatada em CSV.
     */
    async generateCsv(data, columns) {
        return new Promise((resolve, reject) => {
            // Configuração para incluir o cabeçalho e usar a codificação UTF-8
            const options = {
                header: true,
                columns: columns,
                encoding: 'utf8',
                delimiter: ';', // Usar ponto e vírgula é comum no Brasil
            };

            stringify(data, options, (err, output) => {
                if (err) return reject(err);
                resolve(output);
            });
        });
    }

    /**
     * Prepara um conjunto de dados brutos (por exemplo, todos os leads do filtro) para CSV e gera a string final.
     * @param {Array<Object>} leads - Leads a serem exportados (vindo de ReportDataService.getLeadsForExport).
     */
    async exportLeads(leads) {
        const columnsDefinition = [
            { key: 'id', header: 'ID' },
            { key: 'name', header: 'Nome' },
            { key: 'phone', header: 'Telefone' },
            { key: 'email', header: 'E-mail' },
            { key: 'status', header: 'Status' },
            { key: 'origin', header: 'Origem' },
            { key: 'owner_name', header: 'Proprietário' },
            { key: 'avg_consumption', header: 'Consumo Médio (kW)' }, // Adicionado do seu schema Lead.js
            { key: 'estimated_savings', header: 'Economia Estimada (R$)' },
            { key: 'reason_for_loss', header: 'Motivo da Perda' }, // Adicionado do seu schema Lead.js
            { key: 'created_at', header: 'Criado em' },
        ];
        
        // Mapear os dados para garantir que a ordem das colunas e a formatação de data/número sejam respeitadas
        const mappedData = leads.map(lead => ({
            id: lead.id,
            name: lead.name,
            phone: lead.phone,
            email: lead.email || '',
            status: lead.status,
            origin: lead.origin,
            owner_name: lead.owner_name || 'N/A',
            avg_consumption: (lead.avg_consumption ?? 0).toFixed(2).replace('.', ','), // Formatando kW
            estimated_savings: (lead.estimated_savings ?? 0).toFixed(2).replace('.', ','), // Formatando R$
            reason_for_loss: lead.reason_for_loss || '',
            created_at: lead.created_at ? new Date(lead.created_at).toLocaleDateString('pt-BR') : '',
        }));

        // Pega apenas as chaves para a função generateCsv
        const columnKeys = columnsDefinition.map(c => c.key); 
        
        return this.generateCsv(mappedData, columnKeys);
    }
}

module.exports = new CsvGeneratorService();