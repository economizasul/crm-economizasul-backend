// controllers/LeadController.js

const Lead = require('../models/Lead'); 

class LeadController {
    // 1. Criar Lead (POST /api/leads)
    static async createLead(req, res) {
        // ID temporário 1 (substituído pelo ID do usuário autenticado no futuro)
        const owner_id = 1; 
        const { name, email, phone, status, source } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: "O nome do lead é obrigatório." });
        }

        // Definindo status padrão se não for fornecido
        const leadStatus = status || 'Novo';

        try {
            const newLead = await Lead.create({ 
                name, 
                email, 
                phone, 
                status: leadStatus, 
                source, 
                owner_id 
            });
            res.status(201).json({ 
                message: "Lead criado com sucesso!", 
                lead: newLead 
            });
        } catch (error) {
            console.error('Erro ao criar lead:', error);
            res.status(500).json({ error: 'Erro interno do servidor ao criar lead.' });
        }
    }

    // 2. Listar Todos os Leads (GET /api/leads)
    static async getAllLeads(req, res) {
        try {
            const leads = await Lead.findAll();
            res.status(200).json(leads);
        } catch (error) {
            console.error('Erro ao listar leads:', error);
            res.status(500).json({ error: 'Erro interno do servidor ao buscar leads.' });
        }
    }

    // 3. Buscar Lead por ID (GET /api/leads/:id)
    static async getLeadById(req, res) {
        const { id } = req.params;
        try {
            const lead = await Lead.findById(id);

            if (!lead) {
                return res.status(404).json({ error: "Lead não encontrado." });
            }
            res.status(200).json(lead);
        } catch (error) {
            console.error('Erro ao buscar lead por ID:', error);
            res.status(500).json({ error: 'Erro interno do servidor ao buscar lead.' });
        }
    }

    // 4. Atualizar Lead (PUT /api/leads/:id)
    static async updateLead(req, res) {
        const { id } = req.params;
        const { name, email, phone, status, source } = req.body;

        try {
            const updatedLead = await Lead.update(id, { name, email, phone, status, source });

            if (!updatedLead) {
                return res.status(404).json({ error: "Lead não encontrado." });
            }

            res.status(200).json({ 
                message: "Lead atualizado com sucesso!", 
                lead: updatedLead 
            });
        } catch (error) {
            console.error('Erro ao atualizar lead:', error);
            res.status(500).json({ error: 'Erro interno do servidor ao atualizar lead.' });
        }
    }

    // 5. Excluir Lead (DELETE /api/leads/:id)
    static async deleteLead(req, res) {
        const { id } = req.params;

        try {
            const wasDeleted = await Lead.delete(id);

            if (!wasDeleted) {
                return res.status(404).json({ error: "Lead não encontrado." });
            }

            res.status(200).json({ message: "Lead excluído com sucesso." });
        } catch (error) {
            console.error('Erro ao excluir lead:', error);
            res.status(500).json({ error: 'Erro interno do servidor ao excluir lead.' });
        }
    }
}

module.exports = LeadController; // <<< Linha crítica para o deploy