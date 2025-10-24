// controllers/leadController.js

const { pool } = require('../config/db');
const Lead = require('../models/Lead'); 
const axios = require('axios'); // Mantido caso você o use em outras funções

// ===========================
// 🛠️ Função auxiliar para formatar um lead (CRÍTICO: Extrai dados da metadata)
// ===========================
const formatLeadResponse = (lead) => {
    // Tenta extrair a metadata, se existir e for um objeto JSON válido
    const metadata = lead.metadata && typeof lead.metadata === 'object' ? lead.metadata : {};
    
    // As notas vêm da metadata.notes, que é um array de strings
    const notesArray = Array.isArray(metadata.notes) ? metadata.notes : [];

    // O frontend espera um array de objetos { text: string, timestamp: number }
    const notesFormatted = notesArray.map((noteText, index) => ({ 
        text: noteText, 
        // Cria um timestamp básico para ordenação reversa (mais recentes primeiro)
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
        email: metadata.email || '', // LENDO EMAIL DA METADATA
        uc: metadata.uc || '',
        avgConsumption: metadata.avgConsumption || null,
        estimatedSavings: metadata.estimatedSavings || null,
        qsa: metadata.qsa || null,
        notes: notesFormatted, 
        
        created_at: lead.created_at,
        updated_at: lead.updated_at,
    };
};


// ===========================
// 📝 Cria um novo lead (POST /api/v1/leads)
// ===========================
const createLead = async (req, res) => {
    const { name, phone, document, address, status, origin, email, uc, avgConsumption, estimatedSavings, notes, qsa } = req.body;
    const ownerId = req.user.id; 

    if (!name || !phone || !status || !origin) {
        return res.status(400).json({ error: 'Nome, Telefone, Status e Origem são obrigatórios.' });
    }

    try {
        const newLead = await Lead.create({ 
            name, phone, document, address, status, origin, ownerId, email,
            uc, avgConsumption, estimatedSavings, notes, qsa 
        });

        res.status(201).json(formatLeadResponse(newLead));

    } catch (error) {
        if (error.code === '23505') { 
            return res.status(400).json({ error: 'Um lead com o telefone/documento fornecido já existe.' });
        }
        console.error("Erro ao criar lead:", error.message);
        res.status(500).json({ error: "Erro interno do servidor ao criar lead." });
    }
};


// ===========================
// 🧩 Lista todos os leads (GET /api/v1/leads) - ESSA FUNÇÃO ESTAVA FALTANDO OU COM PROBLEMAS
// ===========================
const getAllLeads = async (req, res) => {
    try {
        // Assume-se que 'req.user' é fornecido pelo middleware 'protect'
        const isAdmin = req.user.role === 'Admin';
        const ownerId = req.user.id;

        const leads = await Lead.findAll(ownerId, isAdmin);
        
        const formattedLeads = leads.map(formatLeadResponse);
        
        res.status(200).json(formattedLeads);

    } catch (error) {
        console.error("Erro ao listar leads:", error.message);
        res.status(500).json({ error: "Erro interno do servidor ao listar leads." });
    }
};


// ===========================
// 📝 Atualiza um lead existente (PUT /api/v1/leads/:id) - CORRIGIDO (Manutenção do método que corrigiu o erro 500)
// ===========================
const updateLead = async (req, res) => {
    const { id } = req.params;
    
    // CRÍTICO: Garante que TODOS os campos enviados pelo frontend são extraídos.
    const { 
        name, phone, document, address, status, origin, email, 
        avgConsumption, estimatedSavings, notes, uc, qsa 
    } = req.body;
    
    const ownerId = req.user.id; // Vem do JWT

    // Validação básica
    if (!name || !phone || !status || !origin) {
        return res.status(400).json({ error: 'Nome, Telefone, Status e Origem são obrigatórios.' });
    }

    try {
        // Chama o método 'update' do modelo Lead
        const updatedLead = await Lead.update(id, { 
            name, phone, document, address, status, origin, ownerId, 
            email, 
            // Coerção de tipos antes de enviar ao modelo
            avgConsumption: avgConsumption ? parseFloat(avgConsumption) : null, 
            estimatedSavings: estimatedSavings ? parseFloat(estimatedSavings) : null,
            notes, uc, qsa 
        });

        if (!updatedLead) {
            return res.status(404).json({ error: 'Lead não encontrado ou não autorizado.' });
        }

        res.status(200).json(formatLeadResponse(updatedLead)); 

    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Um lead com o telefone/documento fornecido já existe.' });
        }
        // Este é o erro 500 que você está vendo. A mensagem de erro da DB está no error.message
        console.error("Erro CRÍTICO ao atualizar lead (Log da DB):", error.message);
        res.status(500).json({ error: "Erro interno do servidor ao atualizar lead. Verifique logs do backend." });
    }
};

// ===========================
// 💧 Altera APENAS o status (PUT /api/v1/leads/:id/status)
// ===========================
const updateLeadStatus = async (req, res) => {
    const { id } = req.params;
    const { status: newStatus } = req.body;

    if (!newStatus) {
        return res.status(400).json({ error: 'Novo status é obrigatório.' });
    }

    try {
        const updatedLead = await Lead.updateStatus(id, newStatus);

        if (!updatedLead) {
            return res.status(404).json({ error: 'Lead não encontrado.' });
        }

        res.status(200).json(formatLeadResponse(updatedLead));

    } catch (error) {
        console.error("Erro ao atualizar status do lead:", error.message);
        res.status(500).json({ error: "Erro interno do servidor ao atualizar status." });
    }
};

// ===========================
// 🚀 Exportação CRÍTICA
// ===========================
module.exports = {
    createLead,
    getAllLeads, // <-- AGORA DEFINIDA E EXPORTADA CORRETAMENTE
    updateLead,
    updateLeadStatus,
};