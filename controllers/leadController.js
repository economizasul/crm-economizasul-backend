// controllers/leadController.js

const { pool } = require('../config/db');

// Função auxiliar para formatar um lead
const formatLeadResponse = (lead) => {
    const metadataContent = lead.metadata || {};
    const formatted = {
        _id: lead.id, // Mapeia 'id' (PostgreSQL) para '_id' (Frontend)
        ...lead,
        ...metadataContent,
        ownerId: lead.owner_id, // Inclui explicitamente ownerId
    };
    // Limpeza final do objeto de retorno
    delete formatted.id;
    delete formatted.metadata;
    delete formatted.owner_id; // Remove a chave original
    return formatted;
};

// @desc    Cria um novo lead
// @route   POST /api/v1/leads
// @access  Private
const createLead = async (req, res) => {
    const userId = req.user.id;
    const {
        name, phone, document, address, origin, status,
        notes, qsa, uc, avgConsumption, estimatedSavings
    } = req.body;

    if (!name || !phone) {
        return res.status(400).json({ error: "Nome e telefone do lead são obrigatórios." });
    }

    const metadata = {
        notes: notes || [],
        qsa: qsa || null,
        uc: uc || null,
        avgConsumption: parseFloat(avgConsumption) || 0,
        estimatedSavings: parseFloat(estimatedSavings) || 0,
    };
    const leadStatus = status || 'Para Contatar';
    const leadOrigin = origin || 'outros';

    try {
        const result = await pool.query(
            `INSERT INTO leads (name, phone, document, address, status, origin, owner_id, metadata) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
            RETURNING *`,
            [
                name, phone, document || null, address || null,
                leadStatus, leadOrigin, userId, JSON.stringify(metadata)
            ]
        );

        const formattedLead = formatLeadResponse(result.rows[0]);
        res.status(201).json(formattedLead);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Um lead com o telefone/documento fornecido já existe.' });
        }
        console.error("Erro ao criar lead:", error.message, error.stack);
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

        // Log para depuração
        console.log('Usuário:', req.user);

        // Filtra: Se não for Admin, busca apenas leads do vendedor logado
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