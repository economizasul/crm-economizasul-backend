// controllers/PipelineController.js

// ⭐️ CORRIGIDO: Caminhos ajustados para a nova estrutura (../)
const Lead = require('../models/Lead');
const Client = require('../models/Client');

class PipelineController {
    // Lógica para Promover um Lead a Cliente (POST /api/pipeline/promote/:leadId)
    static async promoteToClient(req, res) {
        const { leadId } = req.params;
        
        try {
            // 1. Tenta encontrar o Lead pelo ID
            const lead = await Lead.findById(leadId);

            if (!lead) {
                return res.status(404).json({ error: "Lead não encontrado." });
            }

            // 2. Garante que o Lead ainda não é "Convertido" (para evitar duplicação)
            if (lead.status === 'Convertido') {
                return res.status(400).json({ error: "Este Lead já foi convertido para Cliente." });
            }

            // 3. Cria um novo Cliente usando os dados do Lead
            const newClient = await Client.create({
                name: lead.name,
                email: lead.email,
                phone: lead.phone,
                owner_id: lead.owner_id 
            });

            // 4. Atualiza o status do Lead para 'Convertido'
            // NOTA: É importante que o `Lead.updateStatus` exista no seu Model
            await Lead.updateStatus(leadId, 'Convertido'); 

            // 5. Retorna o novo Cliente e confirma a operação
            res.status(201).json({
                message: "Lead promovido a Cliente com sucesso!",
                newClient
            });

        } catch (error) {
            console.error('Erro ao promover Lead para Cliente:', error);
            res.status(500).json({ error: 'Erro interno do servidor ao promover Lead.' });
        }
    }
}

module.exports = PipelineController;