// controllers/leadController.js

const { pool } = require('../config/db');
const axios = require('axios');
const Lead = require('../models/Lead'); 

// ===========================
// 🛠️ Função auxiliar para formatar um lead
// ===========================
const formatLeadResponse = (lead) => {
    // CRÍTICO: Lendo 'notes' (coluna TEXT que deve conter string JSON) e convertendo para Array de Objetos para o frontend
    let notesArray = [];
    if (lead.notes && typeof lead.notes === 'string') {
        try {
            // Tenta converter a string do DB (que deve ser JSON) de volta para Array de Objetos JS
            const parsedNotes = JSON.parse(lead.notes);
            
            // Verifica se o resultado é um array válido
            if (Array.isArray(parsedNotes)) {
                notesArray = parsedNotes.filter(note => note && note.text); // Filtra por segurança
            } else {
                 // Se o parse foi um objeto, trata como uma única nota (pode acontecer com strings antigas)
                notesArray = [{ text: lead.notes, timestamp: new Date(lead.updated_at).getTime() }];
            }
        } catch (e) {
            // Se o parse falhar (ex: a string danificada que você viu), trata como uma única nota simples
            console.warn(`Aviso: Falha ao fazer JSON.parse na nota do Lead ID ${lead.id}. Salvando como nota única.`);
            notesArray = [{ text: lead.notes, timestamp: new Date(lead.updated_at).getTime() }];
        }
    } else if (Array.isArray(lead.notes)) {
         // Caso fallback se já for array (pode ocorrer em JSONB ou se for um objeto novo)
        notesArray = lead.notes.filter(note => note && note.text);
    }
    
    // Filtra notesArray para limpar qualquer resquício de strings danificadas.
    // Garante que o notes sempre será um Array de Objetos para o Frontend
    
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
        avgConsumption: lead.avg_consumption || null,      
        estimatedSavings: lead.estimated_savings || null,  
        qsa: lead.qsa || '',
        lat: lead.lat || null,
        lng: lead.lng || null,
        notes: notesArray, // Array de objetos formatado
        
        created_at: lead.created_at,
        updated_at: lead.updated_at,
    };
};

// ===========================
// 📝 Cria um novo lead (POST /api/v1/leads)
// ===========================
const createLead = async (req, res) => {
    const { 
        name, phone, document, address, origin, status, email, 
        avgConsumption, estimatedSavings, notes, uc, qsa, lat, lng
    } = req.body;
    
    const ownerId = req.user.id;

    if (!name || !phone || !status || !origin) {
        return res.status(400).json({ error: 'Nome, Telefone, Status e Origem são obrigatórios.' });
    }

    try {
        // Se notes vier como Array de Objetos do frontend, ele DEVE ter sido stringificado no frontend.
        // Se notes não for uma string (ou for undefined), vamos stringificar um array vazio por segurança.
        const notesToSave = typeof notes === 'string' ? notes : (notes ? JSON.stringify(notes) : '[]');

        const newLead = await Lead.create({ 
            name, phone, document, address, status, origin, ownerId, 
            email, uc, avgConsumption, estimatedSavings, notes: notesToSave, qsa, lat, lng 
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
    
    const { 
        name, phone, document, address, status, origin, email, 
        avgConsumption, estimatedSavings, notes, uc, qsa, lat, lng 
    } = req.body;
    
    const ownerId = req.user.id; 

    if (!name || !phone || !status || !origin) {
        return res.status(400).json({ error: 'Nome, Telefone, Status e Origem são obrigatórios.' });
    }

    try {
        // CRÍTICO: notes deve ser uma string JSON válida vinda do frontend para a coluna TEXT.
        // Se por algum motivo veio como objeto/array, o frontend precisa ser corrigido, mas stringificamos para não falhar a query.
        const notesToSave = typeof notes === 'string' ? notes : JSON.stringify(notes || []);

        const updatedLead = await Lead.update(id, { 
            name, phone, document, address, status, origin, ownerId, 
            email, avgConsumption, estimatedSavings, notes: notesToSave, uc, qsa, lat, lng 
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
        const lead = await Lead.findById(id);
        if (!lead) {
            return res.status(404).json({ error: 'Lead não encontrado.' });
        }
        if (req.user.role !== 'Admin' && lead.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para excluir este lead.' });
        }

        const wasDeleted = await Lead.delete(id);

        if (!wasDeleted) {
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
};