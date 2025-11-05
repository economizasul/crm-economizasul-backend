// controllers/authController.js

// ⭐️ CORRIGIDO: Caminho ajustado para a nova estrutura (../)
const { pool } = require('../config/db'); 
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken');

// Função auxiliar para gerar JWT
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            relatorios_proprios_only: user.relatorios_proprios_only ?? true,
            relatorios_todos: user.relatorios_todos ?? false,
            transferencia_leads: user.transferencia_leads ?? false,
            acesso_configuracoes: user.acesso_configuracoes ?? false
        },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );
};

// @desc    Registrar novo usuário
// @route   POST /api/v1/auth/register
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
            return res.status(409).json({ error: 'E-mail já está em uso.' });
        }

        // 2. Hash da Senha
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Inserir novo usuário
        const insertQuery = `
            INSERT INTO users (name, email, password, phone, role)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, name, email, role;
        `;
        const result = await pool.query(insertQuery, [name, email, hashedPassword, role, role]);
        const newUser = result.rows[0];

        res.status(201).json({
            ...newUser,
            token: generateToken(newUser),
        });

    } catch (error) {
        console.error("Erro ao registrar usuário:", error.message);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
};

// @desc    Autenticar usuário
// @route   POST /api/v1/auth/login
// @access  Public
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Por favor, forneça email e senha.' });
    }

    try {
        // Seleciona explicitamente a coluna 'password' e as permissões de relatório
        const result = await pool.query('SELECT id, name, email, role, relatorios_proprios_only, relatorios_todos, transferencia_leads, acesso_configuracoes, password FROM users WHERE email = $1', [email]);
        const user = result.rows[0];
        
        // Verifica se o usuário existe e se a senha corresponde
        if (user && await bcrypt.compare(password, user.password)) {
            // Remove a senha antes de enviar a resposta
            const { password, ...userData } = user;
            
            res.json({
                ...userData,
                token: generateToken(userData), // <- PASSA O USER INTEIRO
            });
        } else {
            // Falha na autenticação (usuário não encontrado ou senha incorreta)
            res.status(401).json({ error: 'Credenciais inválidas.' });
        }

    } catch (error) {
        console.error("Erro ao fazer login:", error.message);
        res.status(500).json({ error: 'Erro interno do servidor ao tentar logar.' });
    }
};

module.exports = {
    registerUser,
    loginUser,
};