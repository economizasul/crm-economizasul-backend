// src/services/CsvGeneratorService.js

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
     * Prepara um conjunto de dados brutos (por exemplo, todos os leads do filtro) para CSV.
     * @param {Array<Object>} leads - Leads a serem exportados.
     */
    async exportLeads(leads) {
        const columns = [
            { key: 'id', header: 'ID' },
            { key: 'name', header: 'Nome' },
            { key: 'stage', header: 'Fase' },
            { key: 'source', header: 'Origem' },
            { key: 'value', header: 'Valor (R$)' },
            { key: 'createdAt', header: 'Data de Cadastro' },
            // Adicione mais colunas do seu Schema aqui
        ];
        
        // Mapear os dados para garantir que a ordem das colunas seja respeitada
        const mappedData = leads.map(lead => ({
            id: lead.id,
            name: lead.name,
            stage: lead.stage,
            source: lead.source,
            value: lead.value ? lead.value.toFixed(2) : '0.00',
            createdAt: new Date(lead.createdAt).toLocaleDateString('pt-BR'),
        }));
        
        return this.generateCsv(mappedData, columns);
    }
}

module.exports = new CsvGeneratorService();