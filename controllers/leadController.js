// controllers/leadController.js

const { pool } = require('../config/db');
const Lead = require('../models/Lead'); 
const axios = require('axios'); 

// Função auxiliar para formatar um lead 
const formatLeadResponse = (lead) => {
    // Tenta extrair a metadata, se existir e for um objeto JSON válido
    const metadata = lead.metadata && typeof lead.metadata === 'object' ? lead.metadata : {};
    
    // As notas vêm da metadata.notes, que é um array de strings
    const notesArray = Array.isArray(metadata.notes) ? metadata.notes : [];

    // Formata notas para o frontend (array de objetos)
    const notesFormatted = notesArray.map((noteText, index) => ({ 
        text: noteText, 
        // Cria um timestamp básico para ordenação reversa
        timestamp: lead.updated_at ? new Date(lead.updated_at).getTime() - (notesArray.length - 1 - index) * 1000 : 0
    }));

    return {
        _id: lead.id,
        name: lead.name,
        phone: lead.phone,
        document: lead.document,
        address: lead.address,
        status: lead.status, 
        origin: lead.origin,
        ownerId: lead.owner_id,
        
        // Campos de metadata
        email: metadata.email || '', 
        uc: metadata.uc || '',
        avgConsumption: metadata.avgConsumption || null,
        estimatedSavings: metadata.estimatedSavings || null,
        qsa: metadata.qsa || null,
        notes: notesFormatted, 
        
        created_at: lead.created_at,
        updated_at: lead.updated_at,
    };
};


// ... (Outras funções: createLead, getAllLeads, updateLeadStatus) ...


// ===========================
// 📝 Atualiza um lead existente (PUT /api/v1/leads/:id) - CORREÇÃO FINAL
// ===========================
const updateLead = async (req, res) => {
    const { id } = req.params;
    
    // CRÍTICO: Garante que TODOS os campos enviados pelo frontend são extraídos.
    const { 
        name, phone, document, address, status, origin, email, 
        avgConsumption, estimatedSavings, notes, uc, qsa 
    } = req.body;
    
    const ownerId = req.user.id; 

    // Validação básica (deve cobrir as colunas NOT NULL do seu DB)
    if (!name || !phone || !status || !origin) {
        return res.status(400).json({ error: 'Nome, Telefone, Status e Origem são obrigatórios.' });
    }

    try {
        // Chama o método 'update' do modelo Lead
        const updatedLead = await Lead.update(id, { 
            name, phone, document, address, status, origin, ownerId, 
            email, avgConsumption, estimatedSavings, notes, uc, qsa 
        });

        if (!updatedLead) {
            return res.status(404).json({ error: 'Lead não encontrado ou não autorizado.' });
        }

        // Formata a resposta antes de enviar
        res.status(200).json(formatLeadResponse(updatedLead)); 

    } catch (error) {
        // Código de erro 23505 é para violação de UNIQUE constraint
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Um lead com o telefone/documento fornecido já existe.' });
        }
        // Este é o erro 500 que você está vendo. A mensagem de erro da DB está no error.message
        console.error("Erro CRÍTICO ao atualizar lead (Log da DB):", error.message);
        res.status(500).json({ error: "Erro interno do servidor ao atualizar lead. Verifique logs do backend." });
    }
};

module.exports = {
    // ... inclua todas as suas outras funções aqui (createLead, getAllLeads, etc.)
    updateLead,
};