// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const { pool } = require('../../config/db'); 

// =============================================================
// FUNÇÃO AUXILIAR: Buscar usuário por ID
// =============================================================
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

    try {
        // Tenta capturar o token do cabeçalho Authorization
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            console.warn("❌ Nenhum token de autorização fornecido");
            return res.status(401).json({ error: "Token de autorização não fornecido." });
        }

        // Verifica o token JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Busca o usuário associado ao token
        const user = await findUserById(decoded.id || decoded.userId);

        if (!user) {
            console.warn("⚠️ Token válido, mas usuário não encontrado no banco.");
            return res.status(401).json({ error: "Usuário não encontrado ou inativo." });
        }

        // Adiciona o usuário autenticado ao objeto de requisição
        req.user = user;
        next();

    } catch (error) {
        console.error("❌ Erro na verificação do token JWT:", error.message);
        return res.status(401).json({ error: "Token inválido ou expirado." });
    }
};

// =============================================================
// FUNÇÃO adminOnly (verifica acesso de administrador)
// =============================================================
const adminOnly = (req, res, next) => {
    if (req.user?.acesso_configuracoes) {
        next();
    } else {
        return res.status(403).json({ error: "Acesso negado: apenas administradores." });
    }
};

// =============================================================
// FUNÇÃO authorize (verifica se o usuário tem papel permitido)
// =============================================================
const authorize = (...roles) => {
    const expectedRoles = roles.map(role => role.toLowerCase());

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: "Não autenticado." });
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
