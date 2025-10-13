// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const pool = require('../config/db'); 

// Função auxiliar para buscar usuário no DB
const findUserById = async (id) => {
    try {
        // CORREÇÃO CRÍTICA: Converte o ID (que vem como string no token) para Integer.
        // Isso resolve o erro "usuário não encontrado" causado por incompatibilidade de tipos no DB.
        const userIdInt = parseInt(id, 10);
        
        // Busca o usuário pelo ID
        const result = await pool.query('SELECT id, role FROM users WHERE id = $1', [userIdInt]);
        return result.rows[0]; 
    } catch (error) {
        // Loga o erro, mas retorna null para o middleware responder com 401
        console.error("Erro ao buscar usuário no banco de dados:", error.message);
        return null;
    }
};

const protect = async (req, res, next) => {
    let token;

    // 1. Verifica se o header Authorization existe e se começa com 'Bearer'
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Extrai o token, removendo 'Bearer '
            token = req.headers.authorization.split(' ')[1];

            // 2. Decodifica o token usando a chave secreta
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // 3. Busca o usuário no DB pelo ID usando a chave 'userId' do token
            const user = await findUserById(decoded.userId); 

            if (!user) {
                return res.status(401).json({ error: "Não autorizado, usuário não encontrado." });
            }

            // Anexa o usuário logado ao objeto da requisição
            req.user = user;
            
            // Continua
            next();
        } catch (error) {
            // Captura erros de decodificação do JWT (token inválido ou expirado)
            console.error("Erro na autenticação:", error.message);
            return res.status(401).json({ error: "Não autorizado, token inválido ou expirado." });
        }
    }

    if (!token) {
        // Caso o token não tenha sido fornecido
        return res.status(401).json({ error: "Não autorizado, token não encontrado no cabeçalho." });
    }
};

/**
 * Middleware para restringir o acesso apenas a usuários com a role 'Admin'.
 */
const admin = (req, res, next) => {
    if (req.user && req.user.role === 'Admin') {
        next();
    } else {
        return res.status(403).json({ error: "Não autorizado, requer permissão de Admin." });
    }
};

module.exports = { protect, admin };