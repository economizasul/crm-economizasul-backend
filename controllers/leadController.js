// controllers/leadController.js

const { pool } = require('../config/db');

// Função auxiliar para formatar um lead
const formatLeadResponse = (lead) => {
    const metadataContent = lead.metadata || {}; 
    const formatted = {
        _id: lead.id, // Mapeia 'id' (PostgreSQL) para '_id' (Frontend)
        ...lead,
        ...metadataContent, 
    };
    // Limpeza final do objeto de retorno
    delete formatted.id;
    delete formatted.metadata;
    // IMPORTANTE: Deletar a chave da coluna do vendedor (userId) após o mapeamento
    delete formatted.userId;
    return formatted;
};

// @desc    Cria um novo lead
// @route   POST /api/v1/leads
// @access  Private
const createLead = async (req, res) => {
    // ID do usuário logado
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
        // CORREÇÃO: Usando '"userId"' na inserção para respeitar o camelCase no PostgreSQL
        const result = await pool.query(
            `INSERT INTO leads (name, phone, document, address, status, origin, "userId", metadata) 
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
        console.error("Erro ao criar lead:", error.message);
        res.status(500).json({ error: "Erro interno do servidor ao criar lead." });
    }
};

// @desc    Lista todos os leads (Admin) ou leads próprios (User)
// @route   GET /api/v1/leads
// @access  Private
const getAllLeads = async (req, res) => {
    try {
        let queryText = 'SELECT * FROM leads';
        let queryParams = [];

        // Filtra: Se não for Admin, busca apenas leads do vendedor logado
        if (req.user.role && req.user.role !== 'Admin') {
            // 🚨 CORREÇÃO PRINCIPAL: Usando '"userId"' na busca para respeitar o camelCase no PostgreSQL
            queryText += ' WHERE "userId" = $1'; 
            queryParams = [req.user.id];
        }
        
        queryText += ' ORDER BY created_at DESC';

        const result = await pool.query(queryText, queryParams);
        
        const formattedLeads = result.rows.map(formatLeadResponse);
        
        res.status(200).json(formattedLeads);

    } catch (error) {
        console.error('Erro ao buscar leads:', error.message);
        res.status(500).json({ error: 'Erro interno do servidor ao buscar leads.' });
    }
};  

module.exports = {
    createLead,
    getAllLeads,
};