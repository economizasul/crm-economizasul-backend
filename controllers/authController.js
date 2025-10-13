// controllers/authController.js

const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '1d'; // Token expira em 1 dia

/**
 * Função utilitária para gerar o token JWT.
 * @param {number} id - O ID do usuário.
 * @param {string} role - A role do usuário ('Admin' ou 'User').
 * @returns {string} O token JWT.
 */
const generateToken = (id, role) => {
    return jwt.sign({ userId: id, role: role }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
    });
};

// @desc    Registrar um novo usuário
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    const { name, email, password } = req.body;

    // Validação
    if (!name || !email || !password) {
        return res.status(400).json({ error: "Por favor, preencha todos os campos: nome, email e senha." });
    }

    try {
        // 1. Verifica se o usuário já existe
        const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: "Usuário já existe." });
        }

        // 2. Hash da senha
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Define a role (primeiro usuário é Admin)
        const totalUsers = await pool.query('SELECT COUNT(*) FROM users');
        const role = (parseInt(totalUsers.rows[0].count) === 0) ? 'Admin' : 'User';

        // 4. Insere o novo usuário
        const result = await pool.query(
            'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
            [name, email, hashedPassword, role]
        );
        const newUser = result.rows[0];

        // 5. Cria o token de autenticação
        const token = generateToken(newUser.id, newUser.role);

        // 6. Resposta de sucesso
        res.status(201).json({
            message: "Usuário registrado com sucesso!",
            token,
            user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role }
        });

    } catch (error) {
        console.error("Erro no registro:", error.message);
        res.status(500).json({ error: "Erro interno do servidor ao registrar usuário." });
    }
};

// @desc    Autenticar usuário (Login)
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    // Validação
    if (!email || !password) {
        return res.status(400).json({ error: "Por favor, forneça email e senha." });
    }

    try {
        // 1. Busca o usuário no DB
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        // 2. Verifica credenciais (usuário existe e senha corresponde)
        if (user && (await bcrypt.compare(password, user.password))) {
            
            // 3. Cria o token de autenticação
            const token = generateToken(user.id, user.role);

            // 4. Resposta de sucesso
            res.status(200).json({
                message: "Login bem-sucedido!",
                token,
                user: { id: user.id, name: user.name, email: user.email, role: user.role }
            });
        } else {
            return res.status(401).json({ error: "Credenciais inválidas (Email ou Senha incorretos)." });
        }
    } catch (error) {
        console.error("Erro no login:", error.message);
        res.status(500).json({ error: "Erro interno do servidor ao fazer login." });
    }
};


module.exports = {
    registerUser,
    loginUser,
};