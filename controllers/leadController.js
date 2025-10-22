// controllers/leadController.js

const { pool } = require('../config/db');
const axios = require('axios');

// Função auxiliar para formatar um lead
const formatLeadResponse = (lead) => {
  // Garante que o notes seja um array para o frontend
  const notesArray = Array.isArray(lead.notes) ? lead.notes : [];

  // O frontend espera um array de objetos { text: string, timestamp: number }
  // Usamos o updated_at do lead como base para um timestamp de ordenação
  const notesFormatted = notesArray.map((noteText, index) => ({ 
      text: noteText, 
      // Cria um timestamp básico para ordenação, usando a data de atualização.
      // A data exata da nota é geralmente adicionada no frontend.
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
    email: lead.email,
    uc: lead.uc,
    avgConsumption: lead.avg_consumption,
    estimatedSavings: lead.estimated_savings,
    qsa: lead.qsa,
    notes: notesFormatted, // CRÍTICO: Notes é coluna direta e enviado como array de objetos
    createdAt: lead.created_at,
    updatedAt: lead.updated_at,
    lastAttendance: lead.last_attendance,
    attendanceNotes: lead.attendance_notes,
    lat: lead.lat,
    lng: lead.lng,
  };
};

// ===========================
// 🧩 Criar novo lead
// ===========================
const createLead = async (req, res) => {
  const userId = req.user.id;
  const {
    name, phone, document, address, status, origin, email,
    uc, avgConsumption, estimatedSavings, qsa, notes
  } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: "Nome e telefone do lead são obrigatórios." });
  }

  const notesArray = Array.isArray(notes) ? notes : [];
  
  try {
    const result = await pool.query(
      'INSERT INTO leads (name, phone, document, address, status, origin, email, uc, avg_consumption, estimated_savings, qsa, notes, "userId") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *',
      [name, phone, document, address, status, origin, email, uc, avgConsumption, estimatedSavings, qsa, notesArray, userId]
    );

    const formattedLead = formatLeadResponse(result.rows[0]);
    res.status(201).json(formattedLead);

  } catch (error) {
    if (error.code === '23505') { 
      return res.status(400).json({ error: 'Um lead com o telefone/documento fornecido já existe.' });
    }
    console.error("Erro ao criar lead:", error.message);
    res.status(500).json({ error: "Erro interno do servidor ao criar lead." });
  }
};

// ===========================
// 🧩 Atualizar lead (PUT) <--- FUNÇÃO CORRIGIDA E ADICIONADA
// ===========================
const updateLead = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id; // Verifica o dono do lead

    const {
        name, phone, document, address, status, origin, email,
        uc, avgConsumption, estimatedSavings, qsa, notes // notes deve ser um array de strings
    } = req.body;
    
    // Converte notes para array, se for nulo ou inválido, para evitar erro de SQL
    const notesArray = Array.isArray(notes) ? notes : [];
    
    try {
        const result = await pool.query(
            `UPDATE leads 
             SET 
                name = $1, phone = $2, document = $3, address = $4, status = $5, 
                origin = $6, email = $7, uc = $8, avg_consumption = $9, 
                estimated_savings = $10, qsa = $11, notes = $12, 
                updated_at = NOW() 
             WHERE id = $13 AND "userId" = $14 
             RETURNING *`,
            [
                name, phone, document, address, status, 
                origin, email, uc, avgConsumption, 
                estimatedSavings, qsa, notesArray,
                id, userId // Parâmetros WHERE
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Lead não encontrado ou você não tem permissão para atualizá-lo.' });
        }

        const formattedLead = formatLeadResponse(result.rows[0]);
        res.status(200).json(formattedLead);
        
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
        
        const formattedLeads = result.rows.map(formatLeadResponse);
        
        res.status(200).json(formattedLeads);

    } catch (error) {
        console.error("Erro ao listar leads:", error.message);
        res.status(500).json({ error: "Erro interno do servidor ao listar leads." });
    }
};


// ... (Inclua o restante do seu arquivo leadController.js, como geocodeAddress, scheduleAttendance, etc.)
// Apenas garanta que updateLead seja exportado no final

module.exports = {
    createLead,
    updateLead, 
    getAllLeads,
    // ... (Outras funções)
};