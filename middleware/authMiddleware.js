// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
// Garante a importação correta
const { pool } = require('../config/db'); 

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
        console.error("Erro ao buscar usuário (findUserById):", error.message);
        return null;
    }
};

// =============================================================
// FUNÇÃO PROTECT (Autentica e anexa o usuário ao req.user)
// =============================================================
const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization?.startsWith('Bearer')) {
        try {
            // 1. Obtém o token do cabeçalho
            token = req.headers.authorization.split(' ')[1];
            
            // 2. Verifica e decodifica o token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // 3. Busca o usuário no DB
            // O payload do token pode ser decoded.id ou decoded.userId
            const user = await findUserById(decoded.id || decoded.userId); 
            
            if (!user) {
                // Caso o token seja válido, mas o ID do usuário não exista mais ou esteja inativo
                return res.status(401).json({ error: "Usuário não encontrado." });
            }

            // 4. Anexa o usuário ao objeto de requisição
            req.user = user;
            next();

        } catch (error) {
            // Este catch pega token expirado, inválido, etc.
            console.error("ERRO na verificação do token JWT:", error.message); 
            return res.status(401).json({ error: "Token inválido ou expirado." });
        }
    } else {
        // Este é o caso se 'Bearer Token' não foi enviado
        return res.status(401).json({ error: "Token de autorização não fornecido." });
    }
};

// ... (Resto das funções adminOnly e authorize mantidas)

const adminOnly = (req, res, next) => {
    if (req.user?.acesso_configuracoes) {
        next();
    } else {
        return res.status(403).json({ error: "Acesso negado: apenas administradores." });
    }
};

const authorize = (...roles) => {
    const expectedRoles = roles.map(role => role.toLowerCase());

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: "Não autenticado" });
        }
        
        const userRole = req.user.role.toLowerCase(); 

        if (expectedRoles.includes(userRole)) {
            next();
        } else {
            return res.status(403).json({ error: `Acesso negado. Requer o papel: ${roles.join(', ')}` });
        }
    };
};


module.exports = { protect, adminOnly, authorize };