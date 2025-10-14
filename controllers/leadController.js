const { pool } = require('../config/db');

// @desc    Cria um novo lead
// @route   POST /api/v1/leads
// @access  Private
const createLead = async (req, res) => {
    // ID do usuário logado (definido pelo middleware 'protect')
    const seller_id = req.user.id; 
    
    // Extrai todos os campos relevantes do body
    const { 
        name, phone, document, address, origin, status, 
        notes, qsa, uc, avgConsumption, estimatedSavings
    } = req.body;

    // 1. Validação mínima (nome e telefone são obrigatórios)
    if (!name || !phone) {
        return res.status(400).json({ error: "Nome e telefone do lead são obrigatórios." });
    }

    // 2. Prepara os dados complexos para o campo JSONB (metadata)
    const metadata = {
        notes: notes || [],
        qsa: qsa || null,
        uc: uc || null,
        // Garante que os campos numéricos sejam floats (ou 0 se vazios)
        avgConsumption: parseFloat(avgConsumption) || 0,
        estimatedSavings: parseFloat(estimatedSavings) || 0,
    };
    
    // 3. Define status e origem padrão
    const leadStatus = status || 'Para Contatar';
    const leadOrigin = origin || 'outros'; 

    try {
        // 4. Query de inserção no PostgreSQL
        const result = await pool.query(
            `INSERT INTO leads (name, phone, document, address, status, origin, seller_id, metadata) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
            RETURNING *`,
            [
                name, phone, document || null, address || null, 
                leadStatus, leadOrigin, seller_id, JSON.stringify(metadata)
            ]
        );

        // 5. Formata o retorno: mapeia 'id' para '_id' e descompacta 'metadata'
        const newLead = result.rows[0];
        const formattedLead = {
            _id: newLead.id,
            ...newLead,
            ...(newLead.metadata || {}),
        };
        delete formattedLead.id;
        delete formattedLead.metadata;
        
        res.status(201).json(formattedLead);

    } catch (error) {
        // Trata erro de violação de unicidade (se houver UNIQUE constraint)
        if (error.code === '23505') { 
             return res.status(400).json({ error: 'Um lead com o telefone/documento fornecido já existe.' });
        }
        console.error("Erro ao criar lead:", error.message);
        res.status(500).json({ error: "Erro interno do servidor ao criar lead." });
    }
};


// @desc    Lista todos os leads (Admin) ou leads próprios (User)
// @route   GET /api/v1/leads
// @access  Private
const getAllLeads = async (req, res) => {
    const user = req.user; 

    try {
        let queryText = 'SELECT * FROM leads';
        let queryParams = [];

        // Filtra: Se não for Admin, busca apenas leads do vendedor logado
        if (user.role !== 'Admin') {
            queryText += ' WHERE seller_id = $1'; 
            queryParams = [user.id];
        }
        
        queryText += ' ORDER BY id DESC';

        const result = await pool.query(queryText, queryParams);
        
        // Formata os leads para o Frontend
        const formattedLeads = result.rows.map(lead => {
            const metadataContent = lead.metadata || {};

            const formatted = {
                _id: lead.id, // Mapeia 'id' (PostgreSQL) para '_id' (Frontend)
                ...lead,
                ...metadataContent, // Descompacta uc, avgConsumption, notes, etc.
            };
            
            // Limpeza final do objeto de retorno
            delete formatted.id;
            delete formatted.metadata;
            return formatted;
        });
        
        res.status(200).json(formattedLeads);
    } catch (error) {
        console.error("Erro ao buscar leads:", error.message);
        res.status(500).json({ error: "Erro interno do servidor ao buscar leads." });
    }
};


module.exports = {
    createLead,
    getAllLeads,
    // As demais funções (getLeadById, updateLead, deleteLead) serão adicionadas
    // e otimizadas em etapas futuras, quando o CRUD completo for necessário.
};
