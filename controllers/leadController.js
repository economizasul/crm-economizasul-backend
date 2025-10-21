// controllers/leadController.js

const { pool } = require('../config/db');

// Função auxiliar para formatar um lead
const formatLeadResponse = (lead) => {
    const formatted = {
        _id: lead.id,
        name: lead.name,
        phone: lead.phone,
        document: lead.document,
        address: lead.address,
        status: lead.status,
        origin: lead.origin,
        ownerId: lead.owner_id,
        email: lead.email,
        uc: lead.uc,
        avgConsumption: lead.avg_consumption,
        estimatedSavings: lead.estimated_savings,
        qsa: lead.qsa,
        notes: lead.notes,
        createdAt: lead.created_at,
    };
    return formatted;
};

// @desc    Cria um novo lead
// @route   POST /api/v1/leads
// @access  Private
const createLead = async (req, res) => {
    const userId = req.user.id;
    const {
        name, phone, document, address, status, origin, email,
        uc, avgConsumption, estimatedSavings, qsa, notes
    } = req.body;

    // Log dos dados recebidos para depuração
    console.log('Dados recebidos para criar lead:', {
        name, phone, document, address, status, origin, email,
        uc, avgConsumption, estimatedSavings, qsa, notes, userId
    });

    if (!name || !phone) {
        console.log('Validação falhou: name ou phone ausentes');
        return res.status(400).json({ error: "Nome e telefone do lead são obrigatórios." });
    }

    try {
        const result = await pool.query(
            `INSERT INTO leads (name, phone, document, address, status, origin, owner_id, email, uc, avg_consumption, estimated_savings, qsa, notes) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
            RETURNING *`,
            [
                name, phone, document || null, address || null, status || 'Para Contatar',
                origin || 'outros', userId, email || null, uc || null,
                parseFloat(avgConsumption) || null, parseFloat(estimatedSavings) || null,
                qsa || null, notes || null
            ]
        );

        console.log('Lead criado com sucesso:', result.rows[0]);
        const formattedLead = formatLeadResponse(result.rows[0]);
        res.status(201).json(formattedLead);
    } catch (error) {
        console.error('Erro ao criar lead:', error.message, error.stack);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Um lead com o telefone ou email fornecido já existe.' });
        }
        res.status(500).json({ error: "Erro interno do servidor ao criar lead.", details: error.message });
    }
};

// @desc    Lista todos os leads (Admin) ou leads próprios (User)
// @route   GET /api/v1/leads
// @access  Private
const getAllLeads = async (req, res) => {
    try {
        let queryText = 'SELECT * FROM leads';
        let queryParams = [];

        console.log('Usuário:', req.user);

        if (req.user.role && req.user.role !== 'Admin') {
            queryText += ' WHERE owner_id = $1';
            queryParams = [req.user.id];
            console.log('Filtrando leads para owner_id:', req.user.id);
        }

        queryText += ' ORDER BY created_at DESC';

        const result = await pool.query(queryText, queryParams);

        console.log('Leads encontrados:', result.rows.length);

        const formattedLeads = result.rows.map(formatLeadResponse);

        res.status(200).json(formattedLeads);
    } catch (error) {
        console.error('Erro ao buscar leads:', error.message, error.stack);
        res.status(500).json({ error: 'Erro interno do servidor ao buscar leads.', details: error.message });
    }
};

module.exports = {
    createLead,
    getAllLeads,
};