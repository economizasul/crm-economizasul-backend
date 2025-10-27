// backend/controllers/userController.js

const { pool } = require('../config/db');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken');

// Função auxiliar para gerar JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d', 
    });
};

// @desc    Buscar um usuário por nome ou email (para o Register.jsx do Admin)
// @route   GET /api/v1/users/search?name=... ou ?email=...
// @access  Private (Admin Only - assumindo que a rota será protegida)
const searchUser = async (req, res) => {
    
    const { email, name } = req.query;

    if (!email && !name) {
        return res.status(400).json({ error: 'Forneça um nome ou e-mail para a busca.' });
    }

    try {
        let result;
        
        // CRÍTICO: Troca de '"isActive"' para 'is_active AS "isActive"'
        // Isso garante que a coluna seja encontrada no DB (is_active) e retornada como "isActive" (camelCase)
        const selectFields = 'id, name, email, phone, role, is_active AS "isActive"';
        
        if (email) {
            // Busca por Email (deve ser exata)
            result = await pool.query(`SELECT ${selectFields} FROM users WHERE email = $1`, [email]);
        } else if (name) {
            // Busca por Nome (usa ILIKE)
            result = await pool.query(`SELECT ${selectFields} FROM users WHERE name ILIKE $1`, [`%${name}%`]);
        } else {
            return res.status(400).json({ error: 'Parâmetro de busca não reconhecido.' });
        }
        
        const user = result.rows[0];

        if (!user) {
            // Retorna 404 para o Frontend saber que pode criar o usuário
            return res.status(404).json({ error: "Usuário não encontrado. Você pode criar um novo com esta informação." });
        }
        
        // Renomeia o ID para _id (se o frontend precisar)
        user._id = user.id;
        delete user.id; 
        
        // O campo "isActive" já está presente no objeto 'user' por causa do ALIAS na query.
        res.status(200).json(user);

    } catch (error) {
        console.error("Erro ao buscar usuário:", error.message);
        res.status(500).json({ error: 'Erro interno do servidor ao buscar.' });
    }
};

// @desc    Atualizar um usuário (nome, telefone, role, isActive)
// @route   PATCH /api/v1/users/:id
// @access  Private (Admin Only)
const updateUser = async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, role, isActive } = req.body;
    
    if (!name || !email || !phone || !role || isActive === undefined) {
        // Adicionada verificação para 'isActive'
        return res.status(400).json({ error: 'Por favor, forneça todos os campos obrigatórios, incluindo o status de ativo.' });
    }

    try {
        // CRÍTICO: Correção do nome da coluna para is_active e updated_at
        const result = await pool.query(
            `UPDATE users 
             SET name = $1, email = $2, phone = $3, role = $4, is_active = $5, updated_at = NOW()
             WHERE id = $6 
             RETURNING id, name, email, phone, role, is_active AS "isActive"`,
            // O valor de 'isActive' do frontend é mapeado para 'is_active' do DB
            [name, email, phone, role, isActive, id] 
        );

        const updatedUser = result.rows[0];

        if (updatedUser) {
            // CRÍTICO: Retorna o objeto completo com a propriedade "isActive" (graças ao ALIAS)
            res.status(200).json({ message: 'Usuário atualizado com sucesso.', user: updatedUser });
        } else {
            res.status(404).json({ error: 'Usuário não encontrado para atualização.' });
        }

    } catch (error) {
        console.error("Erro ao atualizar usuário:", error.message);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Este e-mail já está sendo usado por outra conta.' });
        }
        res.status(500).json({ error: 'Erro interno do servidor ao atualizar.' });
    }
};


module.exports = {
    searchUser,
    updateUser,
};