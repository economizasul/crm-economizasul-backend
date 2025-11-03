// controllers/ReportController.js

const ReportDataService = require('../services/ReportDataService');
// Assumindo que você tem um User Service ou Model para verificar admin
const UserService = { 
    isAdmin: (userId) => true // SIMULANDO: Substitua pela sua lógica real
};

class ReportController {
    
    /**
     * Retorna os dados para o dashboard de relatórios (gráficos e tabelas).
     */
    async getDashboardData(req, res) {
        try {
            // Obter filtros da Query String: /api/reports/data?vendorId=X&periodStart=Y...
            const filters = req.query;
            
            // Dados de permissão do usuário logado (assumindo que o authMiddleware popula req.user)
            const userId = req.user.id;
            const isAdmin = UserService.isAdmin(userId);

            const data = await ReportDataService.getDashboardMetrics(filters, userId, isAdmin);

            return res.json({ success: true, data });
        } catch (error) {
            console.error('Erro ao buscar dados do dashboard:', error);
            return res.status(500).json({ success: false, message: 'Erro interno ao processar relatórios.' });
        }
    }

    /**
     * Retorna os dados para o relatório analítico de atendimento de um lead.
     */
    async getAnalyticReport(req, res) {
        try {
            const { leadId } = req.query;
            if (!leadId) {
                return res.status(400).json({ success: false, message: 'ID do Lead é obrigatório.' });
            }

            const report = await ReportDataService.getAnalyticNotes(leadId);
            
            if (!report) {
                 return res.status(404).json({ success: false, message: 'Lead não encontrado.' });
            }

            // TODO: Adicionar checagem de ownerId aqui, se o usuário não for Admin.

            return res.json({ success: true, data: report });
        } catch (error) {
             console.error('Erro ao buscar relatório analítico:', error);
             return res.status(500).json({ success: false, message: 'Erro interno ao buscar dados.' });
        }
    }

    // Os métodos para exportar PDF e CSV serão adicionados posteriormente.
}

module.exports = new ReportController();