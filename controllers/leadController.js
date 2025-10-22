// controllers/leadController.js - CÓDIGO FINAL

const { pool } = require('../config/db');
const axios = require('axios'); // Para geocodificação, se necessário

// Função auxiliar para formatar um lead (para envio ao Frontend)
const formatLeadResponse = (lead) => {
  // Garante que o notes seja um array para o frontend
  const notesArray = Array.isArray(lead.notes) ? lead.notes : [];

  // O frontend espera um array de objetos { text: string, timestamp: number }
  // Criamos um timestamp básico para ordenação, usando a data de atualização.
  const notesFormatted = notesArray.map((noteText, index) => ({ 
      text: noteText, 
      // Usa updated_at, ou created_at para leads antigos
      timestamp: new Date(lead.updated_at || lead.created_at).getTime() - (notesArray.length - 1 - index) * 1000 
  }));

  return {
    _id: lead.id,
    name: lead.name,
    phone: lead.phone,
    document: lead.document,
    address: lead.address,
    status: lead.status, // CRÍTICO: Status é coluna direta
    origin: lead.origin,
    ownerId: lead.owner_id, // Mantido, mas deletado no getAllLeads
    email: lead.email,
    uc: lead.uc,
    avgConsumption: lead.avg_consumption,
    estimatedSavings: lead.estimated_savings,
    qsa: lead.qsa,
    notes: notesFormatted, // ARRAY DE OBJETOS para o FE
    createdAt: lead.created_at,
    updatedAt: lead.updated_at,
    lat: lead.lat,
    lng: lead.lng,
    // Deletar o userId é feito no getAllLeads
  };
};

// ===========================
// 🧩 Criar novo lead
// ===========================
const createLead = async (req, res) => {
  const userId = req.user.id;
  const {
    name, phone, document, address, status, origin, email,
    uc, avgConsumption, estimatedSavings, qsa, notes // notes é um array de strings
  } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: "Nome e telefone do lead são obrigatórios." });
  }

  const avg_consumption = avgConsumption ? parseFloat(avgConsumption) : null;
  const estimated_savings = estimatedSavings ? parseFloat(estimatedSavings) : null;
  const notesArray = Array.isArray(notes) ? notes : []; // Garante que seja array

  try {
    const queryText = `
      INSERT INTO leads (
        name, phone, document, address, status, origin, email,
        uc, avg_consumption, estimated_savings, qsa, notes, "userId"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *;
    `;
    const queryParams = [
      name, phone, document, address, status || 'Para Contatar', origin, email,
      uc, avg_consumption, estimated_savings, qsa, notesArray, userId
    ];

    const result = await pool.query(queryText, queryParams);
    const newLead = result.rows[0];

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
// 🧩 Atualizar lead (PUT /:id)
// ===========================
const updateLead = async (req, res) => {
    const { id } = req.params;
    const { 
        name, phone, document, address, status, origin, email, 
        uc, avgConsumption, estimatedSavings, qsa, notes
    } = req.body;

    const avg_consumption = avgConsumption ? parseFloat(avgConsumption) : null;
    const estimated_savings = estimatedSavings ? parseFloat(estimatedSavings) : null;
    const notesArray = Array.isArray(notes) ? notes : []; // Array de strings (texto puro)
    
    // Lista de campos a serem atualizados (excluindo os que não podem ou não precisam de update)
    const updateFields = {
        name, phone, document, address, status, origin, email,
        uc, avg_consumption, estimated_savings, qsa, notes: notesArray,
        // Adiciona a atualização de data
        updated_at: new Date() 
    };

    // Remove campos undefined ou vazios para não sobrescrever
    Object.keys(updateFields).forEach(key => {
        if (updateFields[key] === undefined || updateFields[key] === '') {
            delete updateFields[key];
        }
    });

    // Constrói a query SET dinamicamente
    const setQuery = Object.keys(updateFields).map((key, index) => {
        // Usa aspas duplas para o nome das colunas com camelCase no DB
        const dbKey = key.replace(/([A-Z])/g, (g) => `_${g[0].toLowerCase()}`); 
        return `"${dbKey}" = $${index + 2}`; // $2, $3, etc.
    }).join(', ');

    if (!setQuery) {
        return res.status(400).json({ error: "Nenhum campo fornecido para atualização." });
    }

    const queryParams = [id, ...Object.values(updateFields)];

    try {
        const queryText = `
            UPDATE leads 
            SET ${setQuery}
            WHERE id = $1
            RETURNING *;
        `;

        const result = await pool.query(queryText, queryParams);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Lead não encontrado." });
        }

        res.status(200).json(formatLeadResponse(result.rows[0]));

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
            queryText += ' WHERE "userId" = $1'; 
            queryParams = [req.user.id];
        }
        
        queryText += ' ORDER BY created_at DESC';

        const result = await pool.query(queryText, queryParams);
        
        const formattedLeads = result.rows.map(lead => {
            const formatted = formatLeadResponse(lead);
            delete formatted.ownerId; // Remove a chave do vendedor (userId) antes de enviar
            return formatted;
        });
        
        res.status(200).json(formattedLeads);

    } catch (error) {
        console.error("Erro ao listar leads:", error.message);
        res.status(500).json({ error: "Erro interno do servidor ao listar leads." });
    }
};


// ... (Inclua outras funções como geocodeAddress, scheduleAttendance, se existirem)
// ...
// module.exports = { createLead, getAllLeads, updateLead, geocodeAddress, scheduleAttendance };
// No seu caso:
module.exports = { createLead, getAllLeads, updateLead };