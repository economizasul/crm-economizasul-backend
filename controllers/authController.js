// controllers/authController.js

const { pool } = require('../config/db.js'); // CORREÇÃO: Usando a desestruturação e a extensão .js
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken');

// Função auxiliar para gerar JWT
const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: '30d', // Token expira em 30 dias
    });
};

// @desc    Registrar novo usuário
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Por favor, preencha todos os campos.' });
    }

    try {
        // 1. Verificar se o usuário já existe
        const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: 'Usuário já existe.' });
        }

        // 2. Hash da senha
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Inserir novo usuário no banco de dados
        const newUser = await pool.query(
            'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
            [name, email, hashedPassword, role || 'User'] 
        );

        if (newUser.rows.length > 0) {
            const user = newUser.rows[0];
            res.status(201).json({
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user.id),
            });
        } else {
            res.status(400).json({ error: 'Dados do usuário inválidos.' });
        }

    } catch (error) {
        console.error("Erro CRÍTICO no registro (authController):", error.message);
        res.status(500).json({ error: 'Erro interno do servidor ao registrar.' });
    }
};

// @desc    Autenticar (login) um usuário
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Por favor, forneça email e senha.' });
    }

    try {
        // Seleciona explicitamente a coluna 'password'
        const result = await pool.query('SELECT id, name, email, role, password FROM users WHERE email = $1', [email]);
        const user = result.rows[0];
        
        // Verifica se o usuário existe e se a senha corresponde
        if (user && await bcrypt.compare(password, user.password)) {
            // Sucesso no login
            res.json({
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user.id),
            });
        } else {
            // Falha na autenticação (usuário não encontrado ou senha incorreta)
            res.status(401).json({ error: 'Credenciais inválidas.' });
        }

    } catch (error) {
        console.error("Erro CRÍTICO no login (authController):", error.message);
        res.status(500).json({ error: 'Erro interno do servidor ao fazer login.' });
    }
};

module.exports = {
    registerUser,
    loginUser,
};
