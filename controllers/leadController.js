// controllers/leadController.js

const { pool } = require('../config/db');
const axios = require('axios');
const LeadModel = require('../models/Lead'); // Importar o modelo para usar a função updateLead

// Função auxiliar para formatar um lead
const formatLeadResponse = (lead) => {
  // Garante que o notes seja um array para o frontend
  const notesArray = Array.isArray(lead.metadata.notes) ? lead.metadata.notes : [];

  // O frontend espera um array de objetos { text: string, timestamp: number }
  // Usamos o updated_at do lead como base para um timestamp de ordenação
  // Nota: A lógica de timestamp aqui é apenas um fallback. A data real é melhor adicionada no frontend.
  const notesFormatted = notesArray.map((noteText, index) => ({ 
      text: noteText, 
      // Cria um timestamp básico para ordenação, usando a data de atualização.
      timestamp: lead.updated_at ? new Date(lead.updated_at).getTime() - (notesArray.length - 1 - index) * 1000 : 0
  }));

  return {
    _id: lead.id,
    name: lead.name,
    phone: lead.phone,
    document: lead.document,
    address: lead.address,
    status: lead.status, // CRÍTICO: Status é coluna direta
    origin: lead.origin,
    ownerId: lead.owner_id,
    email: lead.metadata.email, // Assume que email está dentro de metadata
    uc: lead.metadata.uc,
    avgConsumption: lead.metadata.avgConsumption,
    estimatedSavings: lead.metadata.estimatedSavings,
    notes: notesFormatted, // Usa as notas formatadas
    qsa: lead.metadata.qsa,
  };
};

// ===========================
// 📦 Cria um novo Lead
// ===========================
const createLead = async (req, res) => {
    const { name, phone, document, address, status, origin, email, uc, avgConsumption, estimatedSavings, notes } = req.body;
    const ownerId = req.user.id; // Obtém o ID do usuário logado do middleware 'protect'

    if (!name || !phone || !origin) {
        return res.status(400).json({ error: 'Nome, Telefone e Origem são campos obrigatórios.' });
    }

    try {
        // Usa o modelo para criar o lead
        const newLead = await LeadModel.create({
            name,
            phone,
            document,
            address,
            status: status || 'Para Contatar',
            origin,
            ownerId,
            email,
            uc,
            avgConsumption,
            estimatedSavings,
            notes,
        });

        res.status(201).json(formatLeadResponse(newLead));

    } catch (error) {
        console.error("Erro ao criar lead:", error.message);
        // Exemplo de como tratar erros de unicidade, se aplicável
        if (error.code === '23505') { // Código de erro para violação de restrição de unicidade (Ex: telefone/documento já cadastrado)
            return res.status(400).json({ error: 'Um lead com o telefone/documento fornecido já existe.' });
        }
        res.status(500).json({ error: "Erro interno do servidor ao criar lead." });
    }
};

// ===========================
// ✏️ Atualiza um Lead Existente
// ===========================
const updateLead = async (req, res) => {
    const { id } = req.params;
    const { status, name, phone, document, address, origin, email, uc, avgConsumption, estimatedSavings, notes } = req.body;
    const ownerId = req.user.id; 

    // O objeto de dados a ser passado para o modelo (o modelo cuidará do metadata)
    const updateData = {
        name, phone, document, address, status, origin, ownerId,
        email, uc, avgConsumption, estimatedSavings, notes
    };

    try {
        // A função update do modelo Lead já está configurada para lidar com a atualização
        const updatedLead = await LeadModel.update(id, updateData); 

        if (!updatedLead) {
            return res.status(404).json({ error: 'Lead não encontrado.' });
        }

        // Verifica se o usuário tem permissão para editar (só o dono ou Admin)
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
            // CORREÇÃO AQUI: Usa o nome correto da coluna 'owner_id'
            queryText += ' WHERE "owner_id" = $1'; 
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
    getAllLeads,
    updateLead,
    // ... (Outras funções, se houver)
};