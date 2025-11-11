// controllers/leadController.js
const { pool } = require('../config/db');
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

  // FORMATA NOTAS COM SEGURANÇA TOTAL
  formatLeadResponse(lead) {
    let notesArray = [];

    if (lead.notes) {
      try {
        const parsed = JSON.parse(lead.notes);
        if (Array.isArray(parsed)) {
          notesArray = parsed.filter(note => note && note.text);
        }
      } catch (e) {
        notesArray = [{ 
          text: typeof lead.notes === 'string' ? lead.notes : 'Nota corrompida', 
          timestamp: Date.now(),
          user: 'Sistema'
        }];
      }
    }

    return {
      _id: lead.id,
      name: lead.name || 'Sem nome',
      email: lead.email || null,
      phone: lead.phone,
      document: lead.document || null,
      address: lead.address || null,
      status: lead.status || 'Novo',
      origin: lead.origin || 'Manual',
      ownerId: lead.owner_id,
      ownerName: lead.owner_name || 'Desconhecido',
      uc: lead.uc || null,
      avgConsumption: lead.avg_consumption || null,
      estimatedSavings: lead.estimated_savings || null,
      qsa: lead.qsa || null,
      notes: notesArray,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
    };
  }

  // CADASTRO COM NOTA AUTOMÁTICA + owner_id FORÇADO
  async createLead(req, res) {
    const { 
      name, email, phone, document, address, status, origin, uc, 
      avg_consumption, estimated_savings, qsa, owner_id: bodyOwnerId 
    } = req.body;

    const finalOwnerId = bodyOwnerId || req.user.id;

    if (!name?.trim()) return res.status(400).json({ error: 'Nome é obrigatório.' });
    if (!phone?.replace(/\D/g, '')?.trim()) return res.status(400).json({ error: 'Telefone é obrigatório.' });
    if (!origin?.trim()) return res.status(400).json({ error: 'Origem é obrigatória.' });

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      return res.status(400).json({ error: 'Telefone deve ter 10 ou 11 dígitos.' });
    }

    try {
      const initialNote = {
        text: `Lead criado por ${req.user.name || 'Usuário'} via formulário (Origem: ${origin.trim()})`,
        timestamp: Date.now(),
        user: req.user.name || 'Sistema'
      };

      const leadData = {
        name: name.trim(),
        email: email?.trim() || null,
        phone: cleanPhone,
        document: document?.trim() || null,
        address: address?.trim() || null,
        status: status || 'Novo',
        origin: origin.trim(),
        owner_id: finalOwnerId,
        uc: uc?.trim() || null,
        avg_consumption: avg_consumption ? parseFloat(avg_consumption) : null,
        estimated_savings: estimated_savings ? parseFloat(estimated_savings) : null,
        qsa: qsa?.trim() || null,
        notes: JSON.stringify([initialNote])
      };

      const newLead = await Lead.create(leadData);

      res.status(201).json({
        message: 'Lead criado com sucesso!',
        lead: this.formatLeadResponse(newLead)
      });

    } catch (error) {
      console.error("Erro ao criar lead:", error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Este e-mail ou documento já está em uso.' });
      }
      res.status(500).json({ error: 'Erro interno do servidor.', details: error.message });
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
      console.error("Erro ao buscar leads:", error);
      res.status(500).json({ error: "Erro ao carregar leads." });
    }
  }

  async getLeadById(req, res) {
    const { id } = req.params;
    try {
      const lead = await Lead.findById(id);
      if (!lead) return res.status(404).json({ error: 'Lead não encontrado.' });
      res.json(this.formatLeadResponse(lead));
    } catch (error) {
      console.error("Erro ao buscar lead por ID:", error);
      res.status(500).json({ error: 'Erro ao buscar lead.' });
    }
  }

  // UPDATE 100% FUNCIONAL: RETORNA LEAD ATUALIZADO
  async updateLead(req, res) {
    const { id } = req.params;
    const { 
      name, email, phone, document, address, status, origin, 
      uc, avg_consumption, estimated_savings, qsa, newNote, owner_id 
    } = req.body;

    try {
      const existingLead = await Lead.findById(id);
      if (!existingLead) return res.status(404).json({ error: 'Lead não encontrado.' });

      if (existingLead.owner_id !== req.user.id && req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Acesso negado.' });
      }

      const updates = {
        name: (name || '').trim() || existingLead.name,
        email: email?.trim() || existingLead.email,
        phone: phone ? phone.replace(/\D/g, '') : existingLead.phone,
        document: (document || '').trim() || existingLead.document,
        address: (address || '').trim() || existingLead.address,
        status: status || existingLead.status,
        origin: (origin || '').trim() || existingLead.origin,
        uc: (uc || '').trim() || existingLead.uc,
        avg_consumption: avg_consumption !== undefined ? (avg_consumption ? parseFloat(avg_consumption) : null) : existingLead.avg_consumption,
        estimated_savings: estimated_savings !== undefined ? (estimated_savings ? parseFloat(estimated_savings) : null) : existingLead.estimated_savings,
        qsa: (qsa || '').trim() || existingLead.qsa
      };

      // ATUALIZA owner_id SE FOR ENVIADO
      if (owner_id !== undefined) {
        updates.owner_id = parseInt(owner_id, 10);
      }

      // ADICIONA NOVA NOTA
      if (newNote?.text?.trim()) {
        let notes = [];
        if (existingLead.notes) {
          try {
            const parsed = JSON.parse(existingLead.notes);
            if (Array.isArray(parsed)) notes = parsed;
          } catch (e) {
            console.warn('JSON de notas corrompido, resetando...');
          }
        }

        notes.push({
          text: newNote.text.trim(),
          timestamp: Date.now(),
          user: req.user.name || 'Usuário'
        });

        updates.notes = JSON.stringify(notes);
      }

      // FAZ O UPDATE
      await Lead.update(id, updates);

      // BUSCA O LEAD ATUALIZADO (OBRIGATÓRIO)
      const updatedLead = await Lead.findById(id);
      if (!updatedLead) {
        return res.status(500).json({ error: 'Erro ao buscar lead atualizado.' });
      }

      res.status(200).json({
        message: 'Lead atualizado com sucesso!',
        lead: this.formatLeadResponse(updatedLead)
      });

    } catch (error) {
      console.error("Erro ao atualizar lead:", error);
      res.status(500).json({ error: 'Erro ao salvar lead.', details: error.message });
    }
  }

  async deleteLead(req, res) {
    const { id } = req.params;
    try {
      const lead = await Lead.findById(id);
      if (!lead) return res.status(404).json({ error: 'Lead não encontrado.' });
      if (lead.owner_id !== req.user.id && req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Acesso negado.' });
      }

      await Lead.delete(id);
      res.json({ message: 'Lead excluído com sucesso.' });
    } catch (error) {
      console.error("Erro ao excluir lead:", error);
      res.status(500).json({ error: 'Erro ao excluir lead.' });
    }
  }

  async getUsersForReassignment(req, res) {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    try {
      const result = await pool.query('SELECT id, name, role FROM users WHERE role IN ($1, $2) ORDER BY name', ['Admin', 'User']);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao listar usuários.' });
    }
  }

  async reassignLead(req, res) {
    const { id } = req.params;
    const { newOwnerId } = req.body;

    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    if (!newOwnerId) {
      return res.status(400).json({ error: 'Novo proprietário é obrigatório.' });
    }

    try {
      const result = await pool.query(
        'UPDATE leads SET owner_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [newOwnerId, id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Lead não encontrado.' });
      }

      const lead = await Lead.findById(id);

      res.json({ 
        message: 'Lead reatribuído com sucesso.', 
        lead: this.formatLeadResponse(lead) 
      });
    } catch (error) {
      console.error("Erro ao reatribuir:", error);
      res.status(500).json({ error: 'Erro ao reatribuir lead.' });
    }
  }
}

module.exports = new LeadController();