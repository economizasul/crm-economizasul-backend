// controllers/leadController.js
const { pool } = require('../config/db');
const axios = require('axios');
const Lead = require('../models/Lead');

class LeadController {
  constructor() {
    this.createLead = this.createLead.bind(this);
    this.getLeads = this.getLeads.bind(this);
    this.getLeadById = this.getLeadById.bind(this);
    this.updateLead = this.updateLead.bind(this);
    this.deleteLead = this.deleteLead.bind(this);
    this.getUsersForReassignment = this.getUsersForReassignment.bind(this);
    this.reassignLead = this.reassignLead.bind(this);
  }

  formatLeadResponse(lead) {
    let notesArray = [];
    if (lead.notes && typeof lead.notes === 'string') {
      try {
        const parsed = JSON.parse(lead.notes);
        notesArray = Array.isArray(parsed) ? parsed.filter(n => n && n.text) : [];
      } catch (e) {
        notesArray = [{ text: lead.notes, timestamp: new Date(lead.updated_at).getTime() }];
      }
    } else if (Array.isArray(lead.notes)) {
      notesArray = lead.notes.filter(n => n && n.text);
    }

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
      notes: notesArray,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
    };
  }

  async createLead(req, res) {
  const { 
    name, email, phone, document, address, status, origin, uc, 
    avg_consumption, estimated_savings, qsa, owner_id: bodyOwnerId 
  } = req.body;

  // FORÇA O DONO: SE VIER NO BODY (do frontend) → USA. SENÃO USA O LOGADO
  const finalOwnerId = bodyOwnerId || req.user.id;

  // VALIDAÇÃO
  if (!name?.trim()) return res.status(400).json({ error: 'Nome é obrigatório.' });
  if (!phone?.replace(/\D/g, '')?.trim()) return res.status(400).json({ error: 'Telefone é obrigatório.' });
  if (!origin?.trim()) return res.status(400).json({ error: 'Origem é obrigatória.' });

  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 10 || cleanPhone.length > 11) {
    return res.status(400).json({ error: 'Telefone inválido.' });
  }

  try {
    const leadData = {
      name: name.trim(),
      email: email?.trim() || null,
      phone: cleanPhone,
      document: document?.trim() || null,
      address: address?.trim() || null,
      status: status || 'Novo',
      origin: origin.trim(),
      owner_id: finalOwnerId, // AQUI ESTÁ O SEGREDO
      uc: uc?.trim() || null,
      avg_consumption: avg_consumption ? parseFloat(avg_consumption) : null,
      estimated_savings: estimated_savings ? parseFloat(estimated_savings) : null,
      qsa: qsa?.trim() || null,
      notes: JSON.stringify([{
        text: `Lead criado via formulário (Origem: ${origin.trim()})`,
        timestamp: Date.now(),
        user: req.user.name
      }])
    };

    const newLead = await Lead.create(leadData);
    
    res.status(201).json({
      message: 'Lead criado com sucesso!',
      lead: this.formatLeadResponse(newLead)
    });

  } catch (error) {
    console.error("Erro ao criar lead:", error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Este e-mail ou documento já existe.' });
    }
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}

  async getLeads(req, res) {
    const { status, ownerId, search } = req.query;
    const userRole = req.user.role;
    const currentUserId = req.user.id;

    try {
      const leads = await Lead.findAll({
        status,
        ownerId: userRole === 'Admin' ? (ownerId || null) : currentUserId,
        search,
        userRole
      });

      res.status(200).json(leads.map(this.formatLeadResponse));
    } catch (error) {
      console.error("Erro ao buscar leads:", error.message);
      res.status(500).json({ error: "Erro interno do servidor ao buscar leads." });
    }
  }

  async getLeadById(req, res) {
    const { id } = req.params;
    try {
      const lead = await Lead.findById(id);
      if (!lead) return res.status(404).json({ error: 'Lead não encontrado.' });
      res.json(this.formatLeadResponse(lead));
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar lead.' });
    }
  }

  async updateLead(req, res) {
    const { id } = req.params;
    const { name, email, phone, document, address, status, origin, ownerId, uc, avgConsumption, estimatedSavings, newNote } = req.body;
    const currentUserId = req.user.id;
    const userRole = req.user.role;

    const leadData = {
      name, email, phone, document, address, status, origin,
      owner_id: ownerId,
      uc, avg_consumption: avgConsumption, estimated_savings: estimatedSavings
    };

    try {
      const existingLead = await Lead.findById(id);
      if (!existingLead) return res.status(404).json({ error: 'Lead não encontrado.' });

      if (existingLead.owner_id !== currentUserId && userRole !== 'Admin') {
        return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para atualizar este lead.' });
      }

      if (newNote && newNote.text && newNote.text.trim()) {
        let notes = [];
        if (existingLead.notes && typeof existingLead.notes === 'string') {
          try { notes = JSON.parse(existingLead.notes); } catch (e) { notes = []; }
        } else if (Array.isArray(existingLead.notes)) {
          notes = existingLead.notes;
        }

        notes.push({
          text: newNote.text.trim(),
          timestamp: Date.now(),
          user: req.user.name || 'Desconhecido'
        });

        leadData.notes = JSON.stringify(notes);
      }

      const updatedLead = await Lead.update(id, leadData);
      if (!updatedLead) return res.status(404).json({ error: 'Lead não encontrado para atualização.' });

      res.json(this.formatLeadResponse(updatedLead));
    } catch (error) {
      console.error("Erro ao atualizar lead:", error.message);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Este e-mail ou documento já está sendo usado por outro lead.' });
      }
      res.status(500).json({ error: "Erro interno do servidor ao atualizar lead." });
    }
  }

  async deleteLead(req, res) {
    const { id } = req.params;
    const currentUserId = req.user.id;
    const userRole = req.user.role;

    try {
      const existingLead = await Lead.findById(id);
      if (!existingLead) return res.status(404).json({ error: 'Lead não encontrado.' });

      if (existingLead.owner_id !== currentUserId && userRole !== 'Admin') {
        return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para excluir este lead.' });
      }

      const wasDeleted = await Lead.delete(id);
      if (!wasDeleted) return res.status(404).json({ error: 'Lead não encontrado.' });

      res.json({ message: 'Lead excluído com sucesso.' });
    } catch (error) {
      console.error("Erro ao excluir lead:", error.message);
      res.status(500).json({ error: "Erro interno do servidor ao excluir lead." });
    }
  }

  async getUsersForReassignment(req, res) {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem listar usuários para reatribuição.' });
    }

    try {
      const result = await pool.query('SELECT id, name, email, role FROM users WHERE role IN ($1, $2) ORDER BY name', ['Admin', 'User']);
      res.json(result.rows);
    } catch (error) {
      console.error("Erro ao listar usuários para reatribuição:", error.message);
      res.status(500).json({ error: "Erro interno do servidor ao listar usuários." });
    }
  }

  async reassignLead(req, res) {
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

      res.json({ message: 'Lead reatribuído com sucesso.', lead: this.formatLeadResponse(result.rows[0]) });
    } catch (error) {
      console.error("Erro ao reatribuir lead:", error.message);
      res.status(500).json({ error: "Erro interno do servidor ao reatribuir lead." });
    }
  }
}

module.exports = new LeadController();