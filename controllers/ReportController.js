// controllers/ReportController.js
const ReportDataService = require('../services/ReportDataService');
const pdfKit = require('pdfkit');
const ExcelJS = require('exceljs');

class ReportController {
  constructor() {
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
      res.status(200).json({ success: true, data: metrics });
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
      res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
  }

  async getAnalyticNotes(req, res) {
    // ⭐️ AJUSTE DE LÓGICA: Recebe filtros do corpo, como as outras rotas de relatório
    try {
        const { filters, userId, isAdmin } = req.body.context;
        // Chama o service para buscar notas baseadas nos filtros de tempo e usuário
        const notes = await ReportDataService.getAnalyticNotes(filters, userId, isAdmin); 
        
        // As notas são retornadas como um array de objetos { leadId, noteText, timestamp, user }
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
          // Busca os dados completos dos leads para exportação
          const leadData = await ReportDataService.getLeadsForExport(filters, userId, isAdmin); 

          // 1. Configurações básicas
          const workbook = new ExcelJS.Workbook();
          const worksheet = workbook.addWorksheet('Leads Report');

          // 2. Definir Colunas 
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
              { header: 'Consumo Médio', key: 'avg_consumption', width: 20 },
              { header: 'Economia Estimada', key: 'estimated_savings', width: 25 },
              { header: 'Notas', key: 'notes', width: 40 },
              { header: 'Criado em', key: 'created_at', width: 20 },
              { header: 'Atualizado em', key: 'updated_at', width: 20 },
          ];

          // 3. Adicionar Linhas
          leadData.forEach(lead => {
              // Formatação de Notas (simplificada para exportação)
              let noteText = '';
              if (lead.notes) {
                  try {
                      // Tenta converter o JSON de notas para uma string simples
                      const notesArray = JSON.parse(lead.notes);
                      if (Array.isArray(notesArray) && notesArray.length > 0) {
                          noteText = notesArray.map(n => n.text).join(' | ');
                      } else {
                          noteText = lead.notes; 
                      }
                  } catch (e) {
                      noteText = lead.notes;
                  }
              }
              
              worksheet.addRow({
                  ...lead,
                  notes: noteText,
                  created_at: lead.created_at ? new Date(lead.created_at).toLocaleString('pt-BR') : '',
                  updated_at: lead.updated_at ? new Date(lead.updated_at).toLocaleString('pt-BR') : ''
              });
          });


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
          // Busca as métricas resumidas para o PDF
          const metrics = await ReportDataService.getDashboardMetrics(filters, userId, isAdmin);

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
          // Ajustado para usar a estrutura de retorno do getDashboardMetrics
          const tableData = [
              ['Métrica', 'Valor'],
              ['Leads Ativos', metrics.leadsActive.toLocaleString('pt-BR')],
              ['Vendas Concluídas (Qtd)', metrics.totalWonCount.toLocaleString('pt-BR')],
              ['Valor Total de Vendas', `R$ ${metrics.totalWonValue.toFixed(2).replace('.', ',')}`],
              ['Taxa de Conversão', `${(metrics.conversionRate * 100).toFixed(2).replace('.', ',')}%`],
              ['Taxa de Perda', `${(metrics.lossRate * 100).toFixed(2).replace('.', ',')}%`],
              ['Tempo Médio de Fechamento', `${metrics.avgClosingTimeDays.toFixed(1)} dias`],
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