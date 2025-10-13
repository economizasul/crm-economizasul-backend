// controllers/leadController.js

const { pool } = require('../config/db');

// @desc    Cria um novo lead
// @route   POST /api/leads
// @access  Private
const createLead = async (req, res) => {
    // O ID do usuário logado é pego do req.user, que é definido pelo middleware 'protect'
    const owner_id = req.user.id;
    const { name, email, phone, status, source } = req.body;

    // Validação básica
    if (!name || !email) {
        return res.status(400).json({ error: "O nome e o email do lead são obrigatórios." });
    }

    // Define o status inicial (se não for fornecido, usa 'Novo')
    const leadStatus = status || 'Novo';

    try {
        // Insere o novo lead no banco de dados, atribuindo o owner_id
        const result = await pool.query(
            'INSERT INTO leads (name, email, phone, status, source, owner_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [name, email, phone, leadStatus, source || null, owner_id]
        );

        res.status(201).json({
            message: "Lead criado com sucesso!",
            lead: result.rows[0]
        });
    } catch (error) {
        console.error("Erro ao criar lead:", error.message);
        res.status(500).json({ error: "Erro interno do servidor ao criar lead." });
    }
};


// @desc    Lista todos os leads (Admin) ou leads próprios (User)
// @route   GET /api/leads
// @access  Private
const getAllLeads = async (req, res) => {
    const user = req.user; // Usuário logado do token

    try {
        let queryText = 'SELECT * FROM leads';
        let queryParams = [];

        // Se o usuário NÃO for Admin, filtra apenas pelos leads que ele possui
        if (user.role !== 'Admin') {
            queryText += ' WHERE owner_id = $1';
            queryParams = [user.id];
        }
        
        // Ordena por ID, do mais novo para o mais antigo (opcional, mas bom)
        queryText += ' ORDER BY id DESC';

        const result = await pool.query(queryText, queryParams);
        
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Erro ao buscar leads:", error.message);
        res.status(500).json({ error: "Erro interno do servidor ao buscar leads." });
    }
};

// @desc    Obtém um lead por ID
// @route   GET /api/leads/:id
// @access  Private
const getLeadById = async (req, res) => {
    const { id } = req.params;
    const user = req.user;

    try {
        const result = await pool.query('SELECT * FROM leads WHERE id = $1', [id]);
        const lead = result.rows[0];

        if (!lead) {
            return res.status(404).json({ error: "Lead não encontrado." });
        }
        
        // Restrição: Se não for Admin, só pode ver leads dos quais é dono
        if (user.role !== 'Admin' && lead.owner_id !== user.id) {
             return res.status(403).json({ error: "Não autorizado a visualizar este lead." });
        }

        res.status(200).json(lead);
    } catch (error) {
        console.error("Erro ao buscar lead por ID:", error.message);
        res.status(500).json({ error: "Erro interno do servidor." });
    }
};

// @desc    Atualiza um lead (apenas Admin pode mudar o dono)
// @route   PUT /api/leads/:id
// @access  Private
const updateLead = async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    const { name, email, phone, status, source, owner_id } = req.body;

    try {
        const leadResult = await pool.query('SELECT owner_id FROM leads WHERE id = $1', [id]);
        const lead = leadResult.rows[0];

        if (!lead) {
            return res.status(404).json({ error: "Lead não encontrado." });
        }

        // Restrição de Acesso:
        // Usuário normal só pode atualizar o lead se for o dono.
        if (user.role !== 'Admin' && lead.owner_id !== user.id) {
             return res.status(403).json({ error: "Não autorizado a atualizar este lead." });
        }

        // Restrição de Permissão:
        // Se for passado um novo 'owner_id', apenas Admin pode fazer essa alteração.
        if (owner_id && user.role !== 'Admin') {
            return res.status(403).json({ error: "Apenas administradores podem transferir a posse de leads." });
        }

        // Constrói a query de update dinamicamente
        const fields = [];
        const values = [];
        let index = 1;

        if (name) { fields.push(`name = $${index++}`); values.push(name); }
        if (email) { fields.push(`email = $${index++}`); values.push(email); }
        if (phone) { fields.push(`phone = $${index++}`); values.push(phone); }
        if (status) { fields.push(`status = $${index++}`); values.push(status); }
        if (source) { fields.push(`source = $${index++}`); values.push(source); }
        
        // owner_id só é atualizado se for passado no body E o usuário for Admin (verificado acima)
        if (owner_id) { fields.push(`owner_id = $${index++}`); values.push(owner_id); }
        
        if (fields.length === 0) {
            return res.status(400).json({ error: "Nenhum campo válido fornecido para atualização." });
        }

        values.push(id); // O último parâmetro é sempre o ID do lead para a cláusula WHERE
        
        const updateQuery = `UPDATE leads SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${index} RETURNING *`;
        
        const result = await pool.query(updateQuery, values);
        
        res.status(200).json({
            message: "Lead atualizado com sucesso!",
            lead: result.rows[0]
        });

    } catch (error) {
        console.error("Erro ao atualizar lead:", error.message);
        res.status(500).json({ error: "Erro interno do servidor." });
    }
};

// @desc    Deleta um lead
// @route   DELETE /api/leads/:id
// @access  Private/Admin
const deleteLead = async (req, res) => {
    const { id } = req.params;
    
    // O middleware 'admin' já garante que apenas administradores cheguem aqui.

    try {
        const result = await pool.query('DELETE FROM leads WHERE id = $1 RETURNING *', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Lead não encontrado." });
        }
        
        res.status(200).json({ message: `Lead ID ${id} deletado com sucesso.` });

    } catch (error) {
        console.error("Erro ao deletar lead:", error.message);
        res.status(500).json({ error: "Erro interno do servidor." });
    }
};


module.exports = {
    createLead,
    getAllLeads,
    getLeadById,
    updateLead,
    deleteLead
};