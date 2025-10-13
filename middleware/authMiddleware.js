// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const { pool } = require('../config/db'); // CORREÇÃO: Importa { pool } desestruturado

// Função auxiliar para buscar usuário no DB
const findUserById = async (id) => {
    try {
        // Correção de tipagem: converte ID (string do token) para Integer.
        const userIdInt = parseInt(id, 10);
        
        const result = await pool.query('SELECT id, role FROM users WHERE id = $1', [userIdInt]);
        return result.rows[0]; 
    } catch (error) {
        console.error("Erro ao buscar usuário no banco de dados:", error.message);
        return null;
    }
};

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            const user = await findUserById(decoded.userId); 

            if (!user) {
                return res.status(401).json({ error: "Não autorizado, usuário não encontrado." });
            }

            req.user = user;
            next();
        } catch (error) {
            console.error("Erro na autenticação:", error.message);
            return res.status(401).json({ error: "Não autorizado, token inválido ou expirado." });
        }
    }

    if (!token) {
        return res.status(401).json({ error: "Não autorizado, token não encontrado no cabeçalho." });
    }
};

const admin = (req, res, next) => {
    if (req.user && req.user.role === 'Admin') {
        next();
    } else {
        return res.status(403).json({ error: "Não autorizado, requer permissão de Admin." });
    }
};

module.exports = { protect, admin };