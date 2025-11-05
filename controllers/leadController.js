// controllers/leadController.js

// ⭐️ CORREÇÃO: Caminhos ajustados para o correto '../'
const { pool } = require('../config/db'); 
const axios = require('axios');
const Lead = require('../models/Lead'); 

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
                // Filtra notas vazias e garante que têm a estrutura mínima
                notesArray = parsedNotes.filter(note => note && note.text); 
            } else {
                // Caso a string seja texto puro e não JSON de array
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
        email: lead.email,
        phone: lead.phone,
        document: lead.document,
        address: lead.address,
        status: lead.status,
        origin: lead.origin,
        ownerId: lead.owner_id,
        ownerName: lead.owner_name,
        uc: lead.uc,
        avgConsumption: lead.avg_consumption,
        estimatedSavings: lead.estimated_savings,
        notes: notesArray, // Formato pronto para o Frontend
        createdAt: lead.created_at,
        updatedAt: lead.updated_at,
    };
};

// ===========================
// 📥 Criação de Lead (POST /api/v1/leads)
// ===========================
const createLead = async (req, res) => {
    const { name, email, phone, document, address, status, origin, uc, avgConsumption, estimatedSavings } = req.body;
    // O owner_id deve vir do token do usuário logado
    const owner_id = req.user.id; 

    if (!name || !email || !phone) {
        return res.status(400).json({ error: 'Nome, email e telefone são obrigatórios.' });
    }

    try {
        const leadData = {
            name,
            email,
            phone,
            document,
            address,
            status: status || 'Novo', // Default para 'Novo'
            origin: origin || 'Manual', // Default para 'Manual'
            owner_id,
            uc,
            avg_consumption: avgConsumption,
            estimated_savings: estimatedSavings
        };

        const newLead = await Lead.create(leadData);
        res.status(201).json(formatLeadResponse(newLead));
    } catch (error) {
        console.error("Erro ao criar lead:", error.message);
        if (error.code === '23505') { // Código de unique constraint
            return res.status(409).json({ error: 'Este e-mail ou documento já está sendo usado por outro lead.' });
        }
        res.status(500).json({ error: 'Erro interno do servidor ao criar lead.' });
    }
};

// ===========================
// 🔍 Listagem/Busca de Leads (GET /api/v1/leads)
// ===========================
const getLeads = async (req, res) => {
    const { status, ownerId, search } = req.query;
    // Apenas Administradores podem passar o filtro 'ownerId' ou ver leads de outros usuários
    const userRole = req.user.role;
    const currentUserId = req.user.id;

    try {
        // A lógica de filtragem de leads por permissão deve ser feita no Model
        const leads = await Lead.findAll({ 
            status, 
            ownerId: userRole === 'Admin' && ownerId ? ownerId : (userRole === 'Admin' ? ownerId : currentUserId),
            search,
            userRole 
        });
        
        res.status(200).json(leads.map(formatLeadResponse));
    } catch (error) {
        console.error("Erro ao buscar leads:", error.message);
        res.status(500).json({ error: "Erro interno do servidor ao buscar leads." });
    }
};

// ===========================
// 📝 Atualização de Lead (PUT /api/v1/leads/:id)
// ===========================
const updateLead = async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, document, address, status, origin, ownerId, uc, avgConsumption, estimatedSavings, newNote } = req.body;
    const currentUserId = req.user.id;
    const userRole = req.user.role;

    // Converte de camelCase para snake_case para o DB
    const leadData = {
        name,
        email,
        phone,
        document,
        address,
        status,
        origin,
        owner_id: ownerId,
        uc,
        avg_consumption: avgConsumption,
        estimated_savings: estimatedSavings
    };
    
    try {
        const existingLead = await Lead.findById(id);

        if (!existingLead) {
            return res.status(404).json({ error: 'Lead não encontrado.' });
        }
        
        // Verificação de permissão: Apenas o proprietário ou Admin pode atualizar
        if (existingLead.owner_id !== currentUserId && userRole !== 'Admin') {
             return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para atualizar este lead.' });
        }

        // === Lógica de Notas ===
        // Se houver uma nova nota, processa as notas existentes
        if (newNote && newNote.text && newNote.text.trim() !== '') {
            let existingNotes = [];
            // Tenta parsear notas existentes (que vêm do DB como string JSON)
            if (existingLead.notes && typeof existingLead.notes === 'string') {
                try {
                    existingNotes = JSON.parse(existingLead.notes);
                    if (!Array.isArray(existingNotes)) existingNotes = [];
                } catch (e) {
                    // Se o parse falhar, assume que a nota é texto simples
                    existingNotes = [{ text: existingLead.notes, timestamp: new Date(existingLead.updated_at).getTime() }];
                }
            } else if (Array.isArray(existingLead.notes)) {
                 existingNotes = existingLead.notes;
            }

            // Adiciona a nova nota
            const newNoteObject = {
                text: newNote.text.trim(),
                timestamp: Date.now(),
                user: req.user.name || 'Desconhecido'
            };
            existingNotes.push(newNoteObject);
            
            // Adiciona a string JSON das notas aos dados de atualização do DB
            leadData.notes = JSON.stringify(existingNotes);
        }

        const updatedLead = await Lead.update(id, leadData);

        if (!updatedLead) {
            return res.status(404).json({ error: 'Lead não encontrado para atualização.' });
        }

        res.status(200).json(formatLeadResponse(updatedLead));

    } catch (error) {
        console.error("Erro ao atualizar lead:", error.message);
        if (error.code === '23505') { // Código de unique constraint
            return res.status(409).json({ error: 'Este e-mail ou documento já está sendo usado por outro lead.' });
        }
        res.status(500).json({ error: "Erro interno do servidor ao atualizar lead." });
    }
};

// ===========================
// 🚮 Exclusão de Lead (DELETE /api/v1/leads/:id)
// ===========================
const deleteLead = async (req, res) => {
    const { id } = req.params;
    const currentUserId = req.user.id;
    const userRole = req.user.role;

    try {
        const existingLead = await Lead.findById(id);

        if (!existingLead) {
            return res.status(404).json({ error: 'Lead não encontrado.' });
        }

        // Verificação de permissão: Apenas o proprietário ou Admin pode excluir
        if (existingLead.owner_id !== currentUserId && userRole !== 'Admin') {
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
    if (req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem listar usuários para reatribuição.' });
    }

    try {
        // Assume que 'User' e 'Admin' são os únicos papéis que podem possuir leads
        const result = await pool.query('SELECT id, name, email, role FROM users WHERE role IN ($1, $2) ORDER BY name', ['Admin', 'User']);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Erro ao listar usuários para reatribuição:", error.message);
        res.status(500).json({ error: "Erro interno do servidor ao listar usuários." });
    }
};

// ===========================
// 🔑 Reatribuição de Lead (PUT /api/v1/leads/:id/reassign)
// ===========================
const reassignLead = async (req, res) => {
    const { id } = req.params;
    const { newOwnerId } = req.body;

    if (req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem reatribuir leads.' });
    }

    if (!newOwnerId) {
        return res.status(400).json({ error: 'O novo ID do proprietário é obrigatório.' });
    }

    try {
        const result = await pool.query(
            'UPDATE leads SET owner_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [newOwnerId, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Lead não encontrado.' });
        }

        res.status(200).json({ message: 'Lead reatribuído com sucesso.', lead: formatLeadResponse(result.rows[0]) });

    } catch (error) {
        console.error("Erro ao reatribuir lead:", error.message);
        res.status(500).json({ error: "Erro interno do servidor ao reatribuir lead." });
    }
};


module.exports = {
    createLead,
    getLeads,
    updateLead,
    deleteLead,
    getUsersForReassignment,
    reassignLead,
};