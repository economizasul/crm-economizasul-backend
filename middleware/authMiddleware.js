// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const { pool } = require('../config/db.js');

const findUserById = async (id) => {
    try {
        const userIdInt = parseInt(id, 10);
        const result = await pool.query(`
            SELECT 
                id, name, email, role, 
                relatorios_proprios_only,
                relatorios_todos,
                transferencia_leads,
                acesso_configuracoes
            FROM users 
            WHERE id = $1 AND is_active = true
        `, [userIdInt]);
        return result.rows[0];
    } catch (error) {
        console.error("Erro ao buscar usuário:", error.message);
        return null;
    }
};

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization?.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            const user = await findUserById(decoded.id || decoded.userId);
            if (!user) {
                return res.status(401).json({ error: "Usuário não encontrado." });
            }

            req.user = user;
            next();
        } catch (error) {
            return res.status(401).json({ error: "Token inválido ou expirado." });
        }
    } else {
        return res.status(401).json({ error: "Token não fornecido." });
    }
};

const adminOnly = (req, res, next) => {
    if (req.user?.acesso_configuracoes) {
        next();
    } else {
        return res.status(403).json({ error: "Acesso negado: apenas administradores." });
    }
};

// CORREÇÃO CRÍTICA: Normaliza o role para minúsculas antes de checar a permissão.
const authorize = (...roles) => {
    // 1. Converte os papéis esperados (passados para authorize) para minúsculas
    const expectedRoles = roles.map(role => role.toLowerCase());

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: "Não autenticado" });
        }
        
        // 2. Converte o papel do usuário logado para minúsculas
        const userRole = req.user.role.toLowerCase(); 

        // 3. Verifica se o papel em minúsculas está na lista de papéis esperados
        if (!expectedRoles.includes(userRole)) {
            return res.status(403).json({ error: `Acesso negado: role ${req.user.role} não autorizado.` });
        }
        next();
    };
};

module.exports = { protect, adminOnly, authorize };