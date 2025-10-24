// controllers/leadController.js

const { pool } = require('../config/db');
const axios = require('axios');
const Lead = require('../models/Lead'); // Importa o modelo Lead

// ===========================
// 🛠️ Função auxiliar para formatar um lead
// ===========================
const formatLeadResponse = (lead) => {
    // ATENÇÃO: Lendo 'notes' (coluna TEXT) e formatando para o frontend
    let notesArray = [];
    if (lead.notes) {
        // Se notes é uma string simples (como a coluna TEXT armazena), transforma em array de objeto para o frontend
        if (typeof lead.notes === 'string') {
            try {
                // Tenta fazer parse se for JSON (caso o frontend tenha salvo assim)
                notesArray = JSON.parse(lead.notes);
            } catch {
                // Se for string simples, cria um objeto nota básico
                notesArray = [{ text: lead.notes, timestamp: new Date(lead.updated_at).getTime() }];
            }
        } else if (Array.isArray(lead.notes)) {
             // Se for array (o que pode acontecer se o DB converter JSONB)
            notesArray = lead.notes;
        }
    }
    
    // Mapeamento CRÍTICO: DB (snake_case) para Frontend (camelCase)
    return {
        _id: lead.id,
        name: lead.name,
        phone: lead.phone,
        document: lead.document,
        address: lead.address,
        status: lead.status, 
        origin: lead.origin,
        ownerId: lead.owner_id,
        
        // Campos customizados lidos diretamente das colunas do DB
        email: lead.email || '',
        uc: lead.uc || '',
        avgConsumption: lead.avg_consumption || null,      // DB: avg_consumption -> Frontend: avgConsumption
        estimatedSavings: lead.estimated_savings || null,  // DB: estimated_savings -> Frontend: estimatedSavings
        qsa: lead.qsa || '',
        lat: lead.lat || null,
        lng: lead.lng || null,
        notes: notesArray, // Array formatado
        
        created_at: lead.created_at,
        updated_at: lead.updated_at,
    };
};

// ===========================
// 📝 Cria um novo lead (POST /api/v1/leads)
// ===========================
const createLead = async (req, res) => {
    // Extrai todos os 11 campos relevantes do body
    const { 
        name, phone, document, address, origin, status, email, 
        avgConsumption, estimatedSavings, notes, uc, qsa, lat, lng
    } = req.body;
    
    const ownerId = req.user.id;

    if (!name || !phone || !status || !origin) {
        return res.status(400).json({ error: 'Nome, Telefone, Status e Origem são obrigatórios.' });
    }

    try {
        const newLead = await Lead.create({ 
            name, phone, document, address, status, origin, ownerId, 
            email, uc, avgConsumption, estimatedSavings, notes, qsa, lat, lng 
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
// 📝 Atualiza um lead existente (PUT /api/v1/leads/:id)
// ===========================
const updateLead = async (req, res) => {
    const { id } = req.params;
    
    // Extrai todos os 11 campos relevantes do body
    const { 
        name, phone, document, address, status, origin, email, 
        avgConsumption, estimatedSavings, notes, uc, qsa, lat, lng 
    } = req.body;
    
    const ownerId = req.user.id; 

    if (!name || !phone || !status || !origin) {
        return res.status(400).json({ error: 'Nome, Telefone, Status e Origem são obrigatórios.' });
    }

    try {
        const updatedLead = await Lead.update(id, { 
            name, phone, document, address, status, origin, ownerId, 
            email, avgConsumption, estimatedSavings, notes, uc, qsa, lat, lng 
        });

        if (!updatedLead) {
            return res.status(404).json({ error: 'Lead não encontrado ou não autorizado.' });
        }

        res.status(200).json(formatLeadResponse(updatedLead)); 

    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Um lead com o telefone/documento fornecido já existe.' });
        }
        console.error("Erro CRÍTICO ao atualizar lead (Log da DB):", error.message);
        res.status(500).json({ error: "Erro interno do servidor ao atualizar lead. Verifique logs do backend." });
    }
};

// ===========================
// 🧩 Lista todos os leads (Admin) ou leads próprios (User)
// ===========================
const getAllLeads = async (req, res) => {
    try {
        // O modelo Lead.findAll já trata o filtro de Admin/User
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
// 👁️ Busca lead por ID (GET /api/v1/leads/:id)
// ===========================
const getLeadById = async (req, res) => {
    const { id } = req.params;

    try {
        const lead = await Lead.findById(id);

        if (!lead) {
            return res.status(404).json({ error: 'Lead não encontrado.' });
        }

        // Validação de acesso (Se não for Admin, verifica se é o owner)
        if (req.user.role !== 'Admin' && lead.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Acesso negado. Você não é o proprietário deste lead.' });
        }

        res.status(200).json(formatLeadResponse(lead));
    } catch (error) {
        console.error("Erro ao buscar lead por ID:", error.message);
        res.status(500).json({ error: "Erro interno do servidor ao buscar lead." });
    }
};

// ===========================
// 🗑️ Exclui um lead (DELETE /api/v1/leads/:id)
// ===========================
const deleteLead = async (req, res) => {
    const { id } = req.params;

    try {
        // Implementar checagem de propriedade antes de deletar
        const lead = await Lead.findById(id);
        if (!lead) {
            return res.status(404).json({ error: 'Lead não encontrado.' });
        }
        if (req.user.role !== 'Admin' && lead.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para excluir este lead.' });
        }

        const wasDeleted = await Lead.delete(id);

        if (!wasDeleted) {
            // Este caso deve ser raro se a checagem acima passou
            return res.status(404).json({ error: 'Lead não encontrado.' });
        }

        res.status(200).json({ message: 'Lead excluído com sucesso.' });
    } catch (error) {
        console.error("Erro ao excluir lead:", error.message);
        res.status(500).json({ error: "Erro interno do servidor ao excluir lead." });
    }
};


module.exports = {
    createLead,
    getAllLeads,
    getLeadById,
    updateLead,
    deleteLead,
    // Se você tiver outras funções como updateStatus, inclua-as aqui:
    // updateLeadStatus, 
};