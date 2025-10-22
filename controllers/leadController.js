// controllers/leadController.js - VERSÃO FINAL CORRIGIDA

const { pool } = require('../config/db');
const axios = require('axios');
const LeadModel = require('../models/Lead'); 

// Função auxiliar para formatar um lead (AJUSTADA PARA USAR METADATA)
const formatLeadResponse = (lead) => {
    // Acessa o metadata ou usa um objeto vazio para segurança
    const metadata = (lead.metadata && typeof lead.metadata === 'object') ? lead.metadata : {};
    
    // Acessa as notas do metadata.notes
    const sourceNotes = metadata.notes;
    const notesArray = Array.isArray(sourceNotes) ? sourceNotes : [];

    // O frontend espera um array de objetos { text: string, timestamp: number }
    const notesFormatted = notesArray.map((noteText, index) => ({ 
        text: noteText, 
        // Cria um timestamp básico para ordenação
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
        ownerId: lead.owner_id, // Usando owner_id do BD
        
        // Lendo dados do Metadata
        email: metadata.email || '', 
        uc: metadata.uc || '',
        avgConsumption: metadata.avgConsumption,
        estimatedSavings: metadata.estimatedSavings,
        qsa: metadata.qsa || null,
        
        notes: notesFormatted, 
        createdAt: lead.created_at,
        updatedAt: lead.updated_at,
    };
};

// ===========================
// 📦 Cria um novo Lead
// ===========================
const createLead = async (req, res) => {
    const ownerId = req.user.id; 
    const { name, phone, document, address, status, origin, email, uc, avgConsumption, estimatedSavings, notes, qsa } = req.body;

    if (!name || !phone || !origin) {
        return res.status(400).json({ error: 'Nome, Telefone e Origem são campos obrigatórios.' });
    }
    
    // Usa o modelo Lead.js.txt que trata do metadata
    try {
        const newLead = await LeadModel.create({
            name,
            phone,
            document,
            address,
            status: status || 'Para Contatar',
            origin,
            ownerId, 
            email, uc, avgConsumption, estimatedSavings, notes, qsa
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
// ✏️ Atualiza um Lead Existente
// ===========================
const updateLead = async (req, res) => {
    const { id } = req.params;
    const { status, name, phone, document, address, origin, email, uc, avgConsumption, estimatedSavings, notes, qsa } = req.body;
    
    // Objeto de dados para o método update do modelo
    const updateData = {
        name, phone, document, address, status, origin, 
        email, uc, avgConsumption, estimatedSavings, notes, qsa,
        ownerId: req.user.id 
    };

    try {
        const updatedLead = await LeadModel.update(id, updateData); 

        if (!updatedLead) {
            return res.status(404).json({ error: 'Lead não encontrado.' });
        }

        // Verifica permissão (Admin ou Dono)
        if (req.user.role !== 'Admin' && updatedLead.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Você não tem permissão para editar este lead.' });
        }

        res.status(200).json(formatLeadResponse(updatedLead));

    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Um lead com o telefone/documento fornecido já existe.' });
        }
        console.error("Erro ao atualizar lead:", error.message);
        res.status(500).json({ error: "Erro interno do servidor ao atualizar lead." });
    }
};


// ===========================
// 🧩 Lista todos os leads (Admin) ou leads próprios (User)
// ===========================
const getAllLeads = async (req, res) => {
    try {
        let queryText = 'SELECT * FROM leads';
        let queryParams = [];

        // Filtra: Se não for Admin, busca apenas leads do vendedor logado
        if (req.user.role && req.user.role !== 'Admin') {
            queryText += ' WHERE "owner_id" = $1'; // CORREÇÃO CRÍTICA APLICADA
            queryParams = [req.user.id];
        }
        
        queryText += ' ORDER BY created_at DESC';

        const result = await pool.query(queryText, queryParams);
        
        const formattedLeads = result.rows.map(formatLeadResponse);
        
        res.status(200).json(formattedLeads);

    } catch (error) {
        console.error("Erro ao listar leads:", error.message);
        res.status(500).json({ error: "Erro interno do servidor ao listar leads." });
    }
};


module.exports = {
    createLead,
    updateLead, 
    getAllLeads,
    // Se a tela de busca usar findById, ele já está no LeadModel
    // Se usar outro filtro (e.g., searchLeads), esta função precisa ser implementada
};