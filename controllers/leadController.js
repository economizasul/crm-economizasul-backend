// controllers/leadController.js
const { pool } = require('../config/db');
//const Lead = require('../models/Lead');

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

    /** 🔹 Formata o objeto Lead de forma segura */
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
    id: lead.id,
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
    // 🟢 CAMPOS NOVOS (GEO)
    lat: lead.lat || null,
    lng: lead.lng || null,
    google_maps_link: lead.google_maps_link || null,
    cidade: lead.cidade || null,
    regiao: lead.regiao || null,
    // 📊 CAMPOS NOVOS (VENDA/PERDA)
    kwSold: lead.kw_sold || 0,
    reasonForLoss: lead.reason_for_loss || null,
    sellerId: lead.seller_id || null,
    sellerName: lead.seller_name || null,
    metadata: lead.metadata || {},
    createdAt: lead.created_at,
    updatedAt: lead.updated_at,
  };
}


/** 🔹 Criação de Lead com geocodificação (BACKEND) */
async createLead(req, res) {
  try {
    const {
      name, email, phone, document, address, status, origin,
      uc, avg_consumption, estimated_savings, qsa, owner_id: bodyOwnerId,
      // 🟢 CAMPOS NOVOS
      kw_sold, metadata, reason_for_loss, seller_id, seller_name,
    } = req.body;

    const finalOwnerId = bodyOwnerId || req.user.id;
    // Validações básicas
    if (!name?.trim()) return res.status(400).json({ error: 'Nome é obrigatório.' });
    if (!phone?.replace(/\D/g, '')?.trim()) return res.status(400).json({ error: 'Telefone é obrigatório.' });
    if (!origin?.trim()) return res.status(400).json({ error: 'Origem é obrigatória.' });  
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      return res.status(400).json({ error: 'Telefone deve ter 10 ou 11 dígitos.' });
    } 
    // 📝 Nota inicial
    const initialNote = {
      text: `Lead criado por ${req.user.name || 'Usuário'} via formulário (Origem: ${origin.trim()})`,
      timestamp: Date.now(),
      user: req.user.name || 'Sistema'
    };
    // ============================================================
    // GEOCODIFICAÇÃO — SÓ FAZ SE O FRONT NÃO ENVIAR lat/lng
    // ============================================================
    let lat = req.body.lat ? parseFloat(req.body.lat) : null;
    let lng = req.body.lng ? parseFloat(req.body.lng) : null; 
    let cidade = req.body.cidade || null;
    let regiao = req.body.regiao || null;
    let google_maps_link = req.body.google_maps_link || null; 
    // Se lat/lng vierem vazios, null, "", undefined ou NaN → geocodifica
    if ((!lat || !lng || isNaN(lat) || isNaN(lng)) || !cidade || !regiao) {
    try {
    const fetch = (await import("node-fetch")).default;
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(address)}`;
    const geoResp = await fetch(url, {
      headers: { "User-Agent": "economizasul-crm/1.0" }
    });
    const data = await geoResp.json();
    if (data && data.length > 0) {
      lat = lat || parseFloat(data[0].lat);
      lng = lng || parseFloat(data[0].lon); 
      const addr = data[0].address || {};
      cidade = cidade || addr.city || addr.town || addr.village || addr.municipality || addr.county || null;
      regiao = regiao || addr.state || addr.region || addr.state_district || null;
      // ⚠️ CORREÇÃO: Link correto para Google Maps
      google_maps_link = `https://maps.google.com/?q=${lat},${lng}`; 
    }
  } catch (e) {
    console.error("❌ Erro ao geocodificar endereço:", e);
  }
}

    // ============================================================
    // MONTA PAYLOAD FINAL PARA INSERÇÃO
    // ============================================================
    const leadData = {
      name: name.trim(),
      email: email?.trim() || null,
      phone: cleanPhone,
      document: document?.trim() || null,
      address: address?.trim() || null,
      status: status || "Novo",
      origin: origin.trim(),
      owner_id: finalOwnerId,
      uc: uc?.trim() || null,
      avg_consumption: avg_consumption ? parseFloat(avg_consumption) : null,
      estimated_savings: estimated_savings ? parseFloat(estimated_savings) : null,
      qsa: qsa?.trim() || null,
      notes: JSON.stringify([initialNote]), 
      lat,
      lng,
      cidade,
      regiao, 
      google_maps_link, 
      // 🟢 CAMPOS NOVOS: prioriza body, senão usa padrão
      kw_sold: kw_sold ? parseFloat(kw_sold) : 0,
      metadata: metadata || {},
      reason_for_loss: reason_for_loss || null,
      seller_id: seller_id || null,
      seller_name: seller_name || null,
    };

    const newLead = await Lead.insert(leadData);

    res.status(201).json({
      message: "Lead criado com sucesso!",
      lead: this.formatLeadResponse(newLead),
    });

  } catch (error) {
    console.error("Erro ao criar lead:", error);
    res.status(500).json({ error: "Erro interno do servidor.", details: error.message });
  }
  }

  /** 🔹 Retorna lista de leads conforme permissão do usuário */
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

  /** 🔹 Retorna um lead específico */
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

  /** 🔹 Atualiza lead (dados, status, notas e transferência de owner_id) */
  async updateLead(req, res) {
    const { id } = req.params;
    const {
      name, email, phone, document, address, status, origin,
      uc, avg_consumption, estimated_savings, qsa, newNote, owner_id,
      // 🟢 CAMPOS NOVOS
      kw_sold, metadata, reason_for_loss, seller_id, seller_name,
    } = req.body;

    try {
      const existingLead = await Lead.findById(id);
      if (!existingLead) return res.status(404).json({ error: 'Lead não encontrado.' });

      // 🔒 Permissões: Admin pode tudo; user apenas se for dono.
      const isOwner = Number(existingLead.owner_id) === Number(req.user.id);
      const isAdmin = req.user.role === 'Admin';
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Acesso negado.' });
      }

      const updates = {
        name: name?.trim() || existingLead.name,
        email: email?.trim() || existingLead.email,
        phone: phone ? phone.replace(/\D/g, '') : existingLead.phone,
        document: document?.trim() || existingLead.document,
        address: address?.trim() || existingLead.address,
        status: status || existingLead.status,
        origin: origin?.trim() || existingLead.origin,
        uc: uc?.trim() || existingLead.uc,
        avg_consumption: avg_consumption !== undefined
          ? (avg_consumption ? parseFloat(avg_consumption) : null)
          : existingLead.avg_consumption,
        estimated_savings: estimated_savings !== undefined
          ? (estimated_savings ? parseFloat(estimated_savings) : null)
          : existingLead.estimated_savings,
        qsa: qsa?.trim() || existingLead.qsa,
      };

      // 🔹 Lógica de Geocodificação para atualização (🟢 CORRIGIDO/ADICIONADO)
      let lat = req.body.lat !== undefined ? parseFloat(req.body.lat) : existingLead.lat;
      let lng = req.body.lng !== undefined ? parseFloat(req.body.lng) : existingLead.lng;
      let cidade = req.body.cidade || existingLead.cidade;
      let regiao = req.body.regiao || existingLead.regiao;
      let google_maps_link = req.body.google_maps_link || existingLead.google_maps_link;
      
      const addressUpdated = address?.trim() && address?.trim() !== existingLead.address;

      // Se o endereço foi atualizado E o front não enviou a nova geolocalização, geocodifica
      if (addressUpdated && updates.address && (!req.body.lat || !req.body.lng || isNaN(lat) || isNaN(lng))) {
          try {
              const fetch = (await import("node-fetch")).default;
              const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(updates.address)}`;
              const geoResp = await fetch(url, {
                  headers: { "User-Agent": "economizasul-crm/1.0" }
              });
              const data = await geoResp.json();

              if (data && data.length > 0) {
                  lat = parseFloat(data[0].lat);
                  lng = parseFloat(data[0].lon);
                  const addr = data[0].address || {};
                  cidade = addr.city || addr.town || addr.village || addr.municipality || addr.county || null;
                  regiao = addr.state || addr.region || addr.state_district || null;
                  // ⚠️ CORREÇÃO: Link correto para Google Maps
                  google_maps_link = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
              }
          } catch (e) {
              console.error("❌ Erro ao re-geocodificar endereço durante update:", e);
          }
      }

      // Aplica os valores de GEO (se vieram do body ou da geocodificação)
      updates.lat = lat;
      updates.lng = lng;
      updates.cidade = cidade;
      updates.regiao = regiao;
      updates.google_maps_link = google_maps_link;
      
      // 🟢 Adiciona novos campos (Venda/Perda)
      if (kw_sold !== undefined) updates.kw_sold = kw_sold ? parseFloat(kw_sold) : 0;
      if (metadata !== undefined) updates.metadata = metadata;
      if (reason_for_loss !== undefined) updates.reason_for_loss = reason_for_loss?.trim() || null;
      if (seller_id !== undefined) updates.seller_id = seller_id || null;
      if (seller_name !== undefined) updates.seller_name = seller_name?.trim() || null;

      // ✅ Admin pode transferir titularidade
      if (isAdmin && owner_id !== undefined) {
        updates.owner_id = parseInt(owner_id, 10);
      }

      // 🟢 Adiciona nova nota (histórico)
      if (newNote?.text?.trim()) {
        let notes = [];
        try {
          notes = existingLead.notes ? JSON.parse(existingLead.notes) : [];
        } catch {
          notes = [];
        }

        notes.push({
          text: newNote.text.trim(),
          timestamp: Date.now(),
          user: req.user.name || 'Usuário'
        });

        updates.notes = JSON.stringify(notes);
      }

      // 📝 Atualiza no banco
      await Lead.update(id, updates);

      const updatedLead = await Lead.findById(id);
      res.status(200).json({
        message: 'Lead atualizado com sucesso!',
        lead: this.formatLeadResponse(updatedLead)
      });

    } catch (error) {
      console.error("Erro ao atualizar lead:", error);
      res.status(500).json({ error: 'Erro ao salvar lead.', details: error.message });
    }
  }

  /** 🔹 Exclusão de lead */
  async deleteLead(req, res) {
  const { id } = req.params;
  try {
    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado.' });
    
    const isOwner = Number(lead.owner_id) === Number(req.user.id);
    if (!isOwner && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    await Lead.delete(id);
    res.json({ message: 'Lead excluído com sucesso.' });
  } catch (error) {
    console.error("Erro ao excluir lead:", error);
    res.status(500).json({ error: 'Erro ao excluir lead.' });
  }
  }

  /** 🔹 Lista de usuários para reatribuição (apenas admin) */
  async getUsersForReassignment(req, res) {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    try {
      const result = await pool.query(
        'SELECT id, name, role FROM users WHERE role IN ($1, $2) ORDER BY name',
        ['Admin', 'User']
      );
      res.json(result.rows);
    } catch (error) {
      console.error("Erro ao listar usuários:", error);
      res.status(500).json({ error: 'Erro ao listar usuários.' });
    }
  }

  /** 🔹 Transferência direta de lead (reassign) */
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
      console.error("Erro ao reatribuir lead:", error);
      res.status(500).json({ error: 'Erro ao reatribuir lead.' });
    }
  }
}

// Buscar todas as notas de um lead
LeadController.getNotesByLead = async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT n.*, u.name AS user_name
      FROM notes n
      LEFT JOIN users u ON n.user_id = u.id
      WHERE n.lead_id = $1
      ORDER BY n.created_at DESC;
    `;
    const result = await pool.query(query, [id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar notas:', error);
    res.status(500).json({ error: 'Erro ao buscar notas.' });
  }
};

// Adicionar nova nota
LeadController.addNote = async (req, res) => {
  const { id } = req.params; // lead_id
  const { content, type } = req.body;
  const userId = req.user?.id || 1; // pega do token, ou usa 1 como fallback

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Conteúdo da nota é obrigatório.' });
  }

  try {
    const query = `
      INSERT INTO notes (lead_id, user_id, type, content, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *;
    `;
    const result = await pool.query(query, [id, userId, type || 'Nota', content.trim()]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao adicionar nota:', error);
    res.status(500).json({ error: 'Erro ao salvar nota.' });
  }
};


module.exports = new LeadController();