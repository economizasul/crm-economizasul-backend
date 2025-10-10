// controllers/LeadController.js
const Lead = require('../models/Lead');

class LeadController {
    
    // 1. Criar Novo Lead (POST /api/leads)
    static async createLead(req, res) {
        try {
            const { name, email, phone, status, source } = req.body;
            
            // Simulação: o Lead será de propriedade do usuário logado (owner_id)
            // Em um cenário real, você buscaria o ID do usuário no token decodificado
            // Por enquanto, vamos usar o ID 1, assumindo que é o seu admin.
            const owner_id = 1; 

            const newLead = await Lead.create({ name, email, phone, status, source, owner_id });

            // Resposta de sucesso
            res.status(201).json({ 
                message: "Lead criado com sucesso!", 
                lead: newLead 
            });

        } catch (error) {
            console.error('Erro ao criar lead:', error.message);
            res.status(500).json({ error: error.message || 'Erro interno ao criar lead.' });
        }
    }

    // 2. Listar Todos os Leads (GET /api/leads)
    static async getAllLeads(req, res) {
        try {
            const leads = await Lead.findAll();
            res.status(200).json(leads);
        } catch (error) {
            console.error('Erro ao listar leads:', error.message);
            res.status(500).json({ error: error.message || 'Erro interno ao listar leads.' });
        }
    }
    
    // As outras funções (getById, update, delete) podem ser adicionadas depois,
    // mas vamos exportar apenas as que criamos agora.
}

// Exporta as funções para serem usadas nas Rotas
module.exports = {
    createLead: LeadController.createLead,
    getAllLeads: LeadController.getAllLeads
};