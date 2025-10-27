// backend/controllers/userController.js

const { pool } = require('../config/db');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Buscar um usuário por nome ou email (para o Register.jsx do Admin)
const searchUser = async (req, res) => {
    
    const { email, name } = req.query;

    // PASSO DE DEBUG: Adicione este console.log para ver o que o backend está recebendo.
    console.log(`[BUSCA USER] Parâmetros recebidos: Email=${email}, Nome=${name}`);
    
    if (!email && !name) {
        return res.status(400).json({ error: 'Forneça um nome ou e-mail para a busca.' });
    }

    try {
        let result;
        // CRÍTICO: Garante o alias para 'isActive' (is_active AS "isActive")
        const selectFields = 'id, name, email, phone, role, is_active AS "isActive"';
        
        if (email) {
            // CORREÇÃO CRÍTICA: Usa LOWER() para tornar a busca de email case-insensitive.
            result = await pool.query(`SELECT ${selectFields} FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
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
        
        // Renomeia o ID
        user._id = user.id;
        delete user.id; 
        
        res.status(200).json(user);

    } catch (error) {
        console.error("Erro ao buscar usuário:", error.message);
        res.status(500).json({ error: 'Erro interno do servidor ao buscar.' });
    }
};

// @desc    Atualizar um usuário (nome, telefone, role, isActive)
const updateUser = async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, role, isActive } = req.body;
    
    if (!name || !email || !phone || !role || isActive === undefined) {
        return res.status(400).json({ error: 'Por favor, forneça todos os campos obrigatórios, incluindo o status de ativo.' });
    }

    try {
        // Assegura o uso de is_active e updated_at no DB
        const result = await pool.query(
            `UPDATE users 
             SET name = $1, email = $2, phone = $3, role = $4, is_active = $5, updated_at = NOW()
             WHERE id = $6 
             RETURNING id, name, email, phone, role, is_active AS "isActive"`,
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