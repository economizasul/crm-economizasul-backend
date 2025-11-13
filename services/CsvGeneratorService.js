// services/CsvGeneratorService.js
const { stringify } = require('csv-stringify'); 

class CsvGeneratorService {
    async generateCsv(data, columns) {
        return new Promise((resolve, reject) => {
            const options = {
                header: true,
                columns: columns,
                encoding: 'utf8',
                delimiter: ';', 
            };
            stringify(data, options, (err, output) => {
                if (err) return reject(err);
                resolve(output);
            });
        });
    }

    async exportLeads(leads) {
        const columnsDefinition = [
            // Definir colunas com base no ReportDataService.getLeadsForExport
            { key: 'id', header: 'ID' },
            { key: 'name', header: 'Nome' },
            { key: 'phone', header: 'Telefone' },
            { key: 'email', header: 'E-mail' },
            { key: 'status', header: 'Status' },
            { key: 'origin', header: 'Origem' },
            { key: 'owner_name', header: 'Proprietário' },
            { key: 'avg_consumption', header: 'Consumo Médio (kW)' }, 
            { key: 'estimated_savings', header: 'Economia Estimada (R$)' },
            { key: 'reason_for_loss', header: 'Motivo da Perda' }, 
            { key: 'created_at', header: 'Criado em' },
        ];
        
        const mappedData = leads.map(lead => ({
            id: lead.id,
            name: lead.name,
            phone: lead.phone,
            email: lead.email || '',
            status: lead.status,
            origin: lead.origin,
            owner_name: lead.owner_name || 'N/A',
            // Formatação para o Brasil (vírgula como decimal)
            avg_consumption: (lead.avg_consumption ?? 0).toFixed(2).replace('.', ','), 
            estimated_savings: (lead.estimated_savings ?? 0).toFixed(2).replace('.', ','), 
            reason_for_loss: lead.reason_for_loss || '',
            created_at: lead.created_at ? new Date(lead.created_at).toLocaleDateString('pt-BR') : '',
        }));

        const columnKeys = columnsDefinition.map(c => c.key); 
        
        return this.generateCsv(mappedData, columnKeys);
    }
}

module.exports = new CsvGeneratorService();