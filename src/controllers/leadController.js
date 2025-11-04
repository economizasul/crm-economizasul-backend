// controllers/leadController.js

const { pool } = require('../../config/db');
const axios = require('axios');
const Lead = require('../../models/Lead'); 

// ===========================
// 🛠️ Função auxiliar para formatar um lead
// ===========================
const formatLeadResponse = (lead) => {
    // CRÍTICO: Lendo 'notes' e convertendo para Array de Objetos para o frontend
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
    
    // Mapeamento DB (snake_case) para Frontend (camelCase)
    return {
        _id: lead.id,
        name: lead.name,
        phone: lead.phone,
        document: lead.document,
        address: lead.address,
        status: lead.status, 
        origin: lead.origin,
        ownerId: lead.owner_id,
        ownerName: lead.owner_name || 'Desconhecido', // 💡 NOVO: Nome do proprietário
        
        email: lead.email || '',
        uc: lead.uc || '',
        avgConsumption: lead.avg_consumption || null,      
        estimatedSavings: lead.estimated_savings || null,  
        qsa: lead.qsa || '',
        lat: lead.lat || null,
        lng: lead.lng || null,
        notes: notesArray,
        
        created_at: lead.created_at,
        updated_at: lead.updated_at,
    };
};

// ===========================
// 📝 Cria um novo lead (POST /api/v1/leads) (Mantida)
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
        
        // Sanitização (Mantida)
        const parsedAvg = parseFloat(avgConsumption);
        const sanitizedAvgConsumption = isNaN(parsedAvg) || avgConsumption === null || avgConsumption === '' ? null : parsedAvg;

        const parsedEst = parseFloat(estimatedSavings);
        const sanitizedEstimatedSavings = isNaN(parsedEst) || estimatedSavings === null || estimatedSavings === '' ? null : parsedEst;

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
// 📝 Atualiza um lead existente (PUT /api/v1/leads/:id) (Mantida)
// ===========================
const updateLead = async (req, res) => {
    const { id } = req.params;
    
    const { 
        name, phone, document, address, status, origin, email, 
        avgConsumption, estimatedSavings, notes, uc, qsa, lat, lng,
        assignedToId // 💡 Recebe o ID para transferência (será null/undefined no Drag&Drop)
    } = req.body;
    
    const currentUserId = req.user.id;

    if (!name || !phone || !status || !origin) {
        return res.status(400).json({ error: 'Nome, Telefone, Status e Origem são obrigatórios.' });
    }

    try {
        // 1. Busca o Lead atual para obter o owner_id original e o nome do proprietário
        const currentLead = await Lead.findById(id);
        if (!currentLead) {
            return res.status(404).json({ error: 'Lead não encontrado.' });
        }
        
        // 2. Verificação de permissão
        const canUpdate = req.user.role === 'Admin' || currentLead.owner_id === currentUserId;

        if (!canUpdate) {
            return res.status(403).json({ error: 'Acesso negado. Você não é o proprietário deste lead nem administrador.' });
        }

        // 3. 💡 CRÍTICO: DETERMINA O NOVO OWNER_ID (Correção do seu problema)
        let newOwnerId = currentLead.owner_id; // Default: Mantém o proprietário atual (e o Admin não o perde)

        // Se 'assignedToId' foi fornecido no payload E o usuário for Admin, reatribui
        // Isso garante que apenas a função explícita de "Reatribuir" feita por um Admin 
        // altere o owner_id.
        if (req.user.role === 'Admin' && assignedToId) {
            const parsedAssignedToId = parseInt(assignedToId, 10);
             // Confirma que o ID é um número válido e diferente do ID atual
            if (!isNaN(parsedAssignedToId)) {
                newOwnerId = parsedAssignedToId;
            }
        }

        // 4. Sanitização (Mantida)
        const parsedAvg = parseFloat(avgConsumption);
        const sanitizedAvgConsumption = isNaN(parsedAvg) || avgConsumption === null || avgConsumption === '' ? null : parsedAvg;

        const parsedEst = parseFloat(estimatedSavings);
        const sanitizedEstimatedSavings = isNaN(parsedEst) || estimatedSavings === null || estimatedSavings === '' ? null : parsedEst;
        
        const notesToSave = typeof notes === 'string' ? notes : JSON.stringify(notes || []);

        // 5. Atualiza no banco de dados
        const updatedLead = await Lead.update(id, { 
            name, phone, document, address, status, origin, 
            ownerId: newOwnerId, // 💡 Usa o ID do proprietário mantido ou reatribuído
            email, 
            avgConsumption: sanitizedAvgConsumption,
            estimatedSavings: sanitizedEstimatedSavings, 
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
// 🧩 Lista todos os leads (Admin) ou leads próprios (User) (CORRIGIDA)
// ===========================
const getAllLeads = async (req, res) => {
    try {
        // CORREÇÃO CRÍTICA:
        // O Lead.findAll agora espera um OBJETO com userId, role e filtros de query string.
        const { id: userId, role } = req.user;
        const { search, status, origin } = req.query;

        // Chamada correta: passando um objeto com as propriedades que o modelo espera
        const leads = await Lead.findAll({
            userId,
            role: role.toLowerCase(), // Garante que 'Admin' ou 'admin' funcione com a lógica do modelo
            search,
            status,
            origin
        });

        const formattedLeads = leads.map(formatLeadResponse);
        
        // DEBBUG: Verifique este log no seu console para confirmar que leads foram encontrados
        console.log(`Leads encontrados e enviados para o frontend: ${leads.length}`); 

        res.status(200).json(formattedLeads);

    } catch (error) {
        console.error("Erro ao listar leads:", error.message);
        res.status(500).json({ error: "Erro interno do servidor ao listar leads." });
    }
};

// ===========================
// 👁️ Busca lead por ID (GET /api/v1/leads/:id) (Mantida)
// ===========================
const getLeadById = async (req, res) => {
    const { id } = req.params;

    try {
        // Assume que findById retorna o owner_name (do JOIN no modelo)
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
// 🗑️ Exclui um lead (DELETE /api/v1/leads/:id) (Mantida)
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
// 👥 Lista usuários para reatribuição (GET /api/v1/leads/users/reassignment) (Mantida)
// ===========================
const getUsersForReassignment = async (req, res) => {
    if (req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem listar usuários para reatribuição.' });
    }

    try {
        const result = await pool.query('SELECT id, name, email, role FROM users WHERE role IN ($1, $2) ORDER BY name', ['Admin', 'User']);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Erro ao listar usuários para reatribuição:", error.message);
        res.status(500).json({ error: "Erro interno do servidor ao listar usuários." });
    }
};


module.exports = {
  getAllLeads,
  createLead,
  getLeadById,
  updateLead,
  deleteLead,
  getUsersForReassignment
};