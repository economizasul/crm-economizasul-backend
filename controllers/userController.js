// backend/controllers/userController.js

const { pool } = require('../config/db');
const bcrypt = require('bcryptjs'); // Necessário se você for adicionar opção de trocar a senha
const jwt = require('jsonwebtoken');

// IMPORTANTE: Adicione a função para gerar token, se não estiver disponível globalmente
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d', // Token expira em 30 dias
    });
};

// @desc    Buscar um usuário por nome ou email (para o Register.jsx do Admin)
// @route   GET /api/v1/users/search?name=... ou ?email=...
// @access  Private (Admin Only - assumindo que a rota será protegida)
const searchUser = async (req, res) => {
    // A validação de Admin deve ocorrer no authMiddleware ou na rota
    
    const { email, name } = req.query;

    if (!email && !name) {
        return res.status(400).json({ error: 'Forneça um nome ou e-mail para a busca.' });
    }

    try {
        let result;
        
        if (email) {
            // Busca por Email (deve ser exata)
            result = await pool.query('SELECT id, name, email, phone, role, "isActive" FROM users WHERE email = $1', [email]);
        } else if (name) {
            // Busca por Nome (usa ILIKE para ignorar case-sensitivity, comum no PostgreSQL)
            // Se o seu DB não for PostgreSQL (ou não suportar ILIKE), mude para LIKE e use LOWER() em ambos os lados.
            // Ex: WHERE LOWER(name) LIKE LOWER($1)
            result = await pool.query('SELECT id, name, email, phone, role, "isActive" FROM users WHERE name ILIKE $1', [`%${name}%`]);
        } else {
            // Este bloco é para redundância, caso o if/else falhe
            return res.status(400).json({ error: 'Parâmetro de busca não reconhecido.' });
        }
        
        const user = result.rows[0];

        if (!user) {
            // Retorna 404 para o Frontend saber que pode criar o usuário
            return res.status(404).json({ error: "Usuário não encontrado." });
        }
        
        // Renomeia o ID para _id para o Frontend (React/Mongoose) não quebrar
        user._id = user.id;
        delete user.id; 
        
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
    
    // NOTA: A lógica para não inativar o próprio Admin deve ser feita no Frontend (Register.jsx)

    if (!name || !email || !phone || !role) {
        return res.status(400).json({ error: 'Por favor, forneça todos os campos obrigatórios.' });
    }

    try {
        const result = await pool.query(
            `UPDATE users 
             SET name = $1, email = $2, phone = $3, role = $4, "isActive" = $5, "updatedAt" = NOW()
             WHERE id = $6 RETURNING id, name, email, role, "isActive"`,
            [name, email, phone, role, isActive, id]
        );

        const updatedUser = result.rows[0];

        if (updatedUser) {
            res.status(200).json({ message: 'Usuário atualizado com sucesso.', user: updatedUser });
        } else {
            res.status(404).json({ error: 'Usuário não encontrado para atualização.' });
        }

    } catch (error) {
        console.error("Erro ao atualizar usuário:", error.message);
        // Tratar erro de duplicidade de email (23505 é o código de erro de violação de unicidade no PostgreSQL)
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