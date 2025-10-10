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
    // Se for admin, lista todos. Se for usuário, lista apenas os seus.
    static async getAllLeads(req, res) {
        const owner_id = req.user.id;
        // Role (função) do usuário: 'admin' ou 'user'
        const userRole = req.user.role; 

        try {
            let leads;
            
            if (userRole === 'admin') {
                // Admin vê TODOS os leads
                leads = await Lead.findAll(); 
            } else {
                // Usuário comum vê APENAS seus próprios leads
                leads = await Lead.findByOwner(owner_id);
            }

            res.status(200).json(leads);
        } catch (error) {
            console.error('Erro ao listar leads:', error);
            res.status(500).json({ error: 'Erro interno do servidor ao buscar leads.' });
        }
    }
    
    // 3. Buscar Lead por ID (GET /api/leads/:id)
    static async getLeadById(req, res) {
        const { id } = req.params;
        const userRole = req.user.role; 

        try {
            const lead = await Lead.findById(id);

            if (!lead) {
                return res.status(404).json({ error: "Lead não encontrado." });
            }

            // SEGURANÇA: Admin pode ver leads de todos. Usuário comum só vê os seus.
            if (userRole !== 'admin' && lead.owner_id !== req.user.id) {
                return res.status(403).json({ error: "Acesso negado." });
            }

            res.status(200).json(lead);
        } catch (error) {
            console.error('Erro ao buscar lead por ID:', error);
            res.status(500).json({ error: 'Erro interno do servidor ao buscar lead.' });
        }
    }

    // 4. Atualizar Lead (PUT /api/leads/:id)
    // Admin pode atualizar o owner_id (mover leads) e todos os outros campos.
    static async updateLead(req, res) {
        const { id } = req.params;
        const owner_id = req.user.id;
        const userRole = req.user.role;
        // new_owner_id é usado APENAS pelo Admin para transferir a posse
        const { name, email, phone, status, source, new_owner_id } = req.body; 
        
        try {
            const existingLead = await Lead.findById(id);

            if (!existingLead) {
                return res.status(404).json({ error: "Lead não encontrado." });
            }

            // Se NÃO for Admin E o Lead não pertencer ao usuário logado, nega acesso
            if (userRole !== 'admin' && existingLead.owner_id !== owner_id) {
                return res.status(403).json({ error: "Acesso negado. Você não é o dono deste Lead." });
            }

            // Lógica de Propriedade (Owner ID):
            // 1. Se for admin E new_owner_id foi fornecido, usa new_owner_id (transferência)
            // 2. Caso contrário, mantém o owner_id atual do Lead
            const final_owner_id = (userRole === 'admin' && new_owner_id) 
                                   ? new_owner_id 
                                   : existingLead.owner_id;


            // Monta o objeto de atualização
            const updateData = { 
                name, 
                email, 
                phone, 
                status, 
                source, 
                owner_id: final_owner_id // owner_id pode mudar se for admin
            };

            const updatedLead = await Lead.update(id, updateData);

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
    // Admin pode excluir qualquer lead.
    static async deleteLead(req, res) {
        const { id } = req.params;
        const owner_id = req.user.id;
        const userRole = req.user.role;

        try {
            const existingLead = await Lead.findById(id);
            
            if (!existingLead) {
                return res.status(404).json({ error: "Lead não encontrado." });
            }
            
            // Se NÃO for Admin E o Lead não pertencer ao usuário logado, nega acesso
            if (userRole !== 'admin' && existingLead.owner_id !== owner_id) {
                 return res.status(403).json({ error: "Acesso negado. Você não tem permissão para excluir este Lead." });
            }
            
            const wasDeleted = await Lead.delete(id);

            res.status(200).json({ message: "Lead excluído com sucesso." });
        } catch (error) {
            console.error('Erro ao excluir lead:', error);
            res.status(500).json({ error: 'Erro interno do servidor ao excluir lead.' });
        }
    }
}

module.exports = LeadController;