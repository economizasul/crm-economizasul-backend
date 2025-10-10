// controllers/LeadController.js

const Lead = require('../models/Lead'); 

class LeadController {
    // 1. Criar Lead (POST /api/leads)
    static async createLead(req, res) {
        // ID do usuário logado obtido do middleware 'protect'
        const owner_id = req.user.id; 
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
                owner_id // USANDO O ID DO USUÁRIO AQUI
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
    // Agora lista apenas leads do usuário logado
    static async getAllLeads(req, res) {
        const owner_id = req.user.id; // ID do usuário logado
        try {
            // Buscando leads APENAS para o ID do usuário logado
            const leads = await Lead.findByOwner(owner_id);
            res.status(200).json(leads);
        } catch (error) {
            console.error('Erro ao listar leads:', error);
            res.status(500).json({ error: 'Erro interno do servidor ao buscar leads.' });
        }
    }
    
    // 3. Buscar Lead por ID (GET /api/leads/:id) - Mantém a busca
    static async getLeadById(req, res) {
        const { id } = req.params;
        try {
            const lead = await Lead.findById(id);

            if (!lead) {
                return res.status(404).json({ error: "Lead não encontrado." });
            }

            // SEGURANÇA: Garante que o usuário só pode ver seus próprios leads
            if (lead.owner_id !== req.user.id) {
                return res.status(403).json({ error: "Acesso negado." });
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
        const owner_id = req.user.id; // ID do usuário logado
        const { name, email, phone, status, source } = req.body;
        
        try {
            // 1. Verifica se o Lead pertence ao usuário
            const existingLead = await Lead.findById(id);
            if (!existingLead || existingLead.owner_id !== owner_id) {
                return res.status(403).json({ error: "Acesso negado ou Lead não encontrado." });
            }

            // 2. Atualiza
            const updatedLead = await Lead.update(id, { name, email, phone, status, source });

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
        const owner_id = req.user.id; // ID do usuário logado

        try {
            // 1. Verifica se o Lead pertence ao usuário antes de excluir
            const existingLead = await Lead.findById(id);
            if (!existingLead || existingLead.owner_id !== owner_id) {
                return res.status(403).json({ error: "Acesso negado ou Lead não encontrado." });
            }
            
            // 2. Exclui
            const wasDeleted = await Lead.delete(id);

            res.status(200).json({ message: "Lead excluído com sucesso." });
        } catch (error) {
            console.error('Erro ao excluir lead:', error);
            res.status(500).json({ error: 'Erro interno do servidor ao excluir lead.' });
        }
    }
}

module.exports = LeadController;