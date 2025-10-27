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
            const parsedNotes = JSON.parse(lead.notes);
            
            if (Array.isArray(parsedNotes)) {
                notesArray = parsedNotes.filter(note => note && note.text); 
            } else {
                notesArray = [{ text: lead.notes, timestamp: new Date(lead.updated_at).getTime() }];
            }
        } catch (e) {
            console.warn(`Aviso: Falha ao fazer JSON.parse na nota do Lead ID ${lead.id}. Salvando como nota única.`);
            notesArray = [{ text: lead.notes, timestamp: new Date(lead.updated_at).getTime() }];
        }
    } else if (Array.isArray(lead.notes)) {
        notesArray = lead.notes.filter(note => note && note.text);
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
        const notesToSave = typeof notes === 'string' ? notes : (notes ? JSON.stringify(notes) : '[]');
        
        // 💡 Sanitização para Create (Prevenindo o NaN se o frontend falhar na conversão inicial)
        const sanitizedAvgConsumption = isNaN(parseFloat(avgConsumption)) || avgConsumption === null || avgConsumption === '' ? null : parseFloat(avgConsumption);
        const sanitizedEstimatedSavings = isNaN(parseFloat(estimatedSavings)) || estimatedSavings === null || estimatedSavings === '' ? null : parseFloat(estimatedSavings);

        const newLead = await Lead.create({ 
            name, phone, document, address, status, origin, ownerId, 
            email, uc, 
            avgConsumption: sanitizedAvgConsumption, 
            estimatedSavings: sanitizedEstimatedSavings, 
            notes: notesToSave, qsa, lat, lng 
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
        avgConsumption, estimatedSavings, notes, uc, qsa, lat, lng,
        assignedToId // 💡 NOVO: Recebe o ID para transferência
    } = req.body;
    
    // O ID do novo proprietário é o 'assignedToId' (se enviado por Admin) ou o ID do usuário logado (padrão)
    // O frontend deve garantir que o assignedToId só é enviado por Admin e que só envia um novo valor se for diferente do atual.
    const newOwnerId = assignedToId || req.user.id; 
    const currentUserId = req.user.id;

    if (!name || !phone || !status || !origin) {
        return res.status(400).json({ error: 'Nome, Telefone, Status e Origem são obrigatórios.' });
    }

    // 💡 CRÍTICO: SANITIZAÇÃO PARA RESOLVER O ERRO "NaN"
    // Garante que o valor enviado para o DB seja 'null' se for NaN ou vazio
    const sanitizedAvgConsumption = isNaN(parseFloat(avgConsumption)) || avgConsumption === null || avgConsumption === '' ? null : parseFloat(avgConsumption);
    const sanitizedEstimatedSavings = isNaN(parseFloat(estimatedSavings)) || estimatedSavings === null || estimatedSavings === '' ? null : parseFloat(estimatedSavings);

    try {
        const notesToSave = typeof notes === 'string' ? notes : JSON.stringify(notes || []);

        // 💡 Verificação de permissão: Admins podem editar, vendedores só podem editar seus próprios leads.
        const currentLead = await Lead.findById(id);
        if (!currentLead) {
             return res.status(404).json({ error: 'Lead não encontrado.' });
        }
        
        // Verifica se o usuário é Admin OU se é o proprietário atual
        const canUpdate = req.user.role === 'Admin' || currentLead.owner_id === currentUserId;

        if (!canUpdate) {
            return res.status(403).json({ error: 'Acesso negado. Você não é o proprietário deste lead nem administrador.' });
        }
        
        const updatedLead = await Lead.update(id, { 
            name, phone, document, address, status, origin, 
            ownerId: newOwnerId, // 💡 Usa o novo ID para transferência (se fornecido)
            email, 
            avgConsumption: sanitizedAvgConsumption, // 💡 Corrigido
            estimatedSavings: sanitizedEstimatedSavings, // 💡 Corrigido
            notes: notesToSave, uc, qsa, lat, lng 
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

// ===========================
// 👥 Lista usuários para reatribuição (GET /api/v1/leads/users/reassignment)
// ===========================
const getUsersForReassignment = async (req, res) => {
    // 💡 CRÍTICO: Apenas Admin pode ver esta lista
    if (req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem listar usuários para reatribuição.' });
    }

    try {
        // Busca todos os usuários, exceto a senha
        // Assumindo que apenas 'Admin' e 'User' (Vendedor) podem receber leads.
        const result = await pool.query('SELECT id, name, email, role FROM users WHERE role IN ($1, $2) ORDER BY name', ['Admin', 'User']);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Erro ao listar usuários para reatribuição:", error.message);
        res.status(500).json({ error: "Erro interno do servidor ao listar usuários." });
    }
};


module.exports = {
    createLead,
    getAllLeads,
    getLeadById,
    updateLead,
    deleteLead,
    getUsersForReassignment, // 💡 NOVO: Exporta a função
};