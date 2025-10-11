const jwt = require('jsonwebtoken');
const pool = require('../config/db'); // Assumindo o pool do DB

// Função auxiliar para buscar usuário no DB
const findUserById = async (id) => {
    try {
        // Busca o usuário pelo ID
        const result = await pool.query('SELECT id, role FROM users WHERE id = $1', [id]);
        return result.rows[0]; // Retorna a primeira linha (o usuário)
    } catch (error) {
        // Logamos o erro no console do servidor (Render) para debug
        console.error("Erro ao buscar usuário no banco de dados:", error.message);
        return null;
    }
};

const protect = async (req, res, next) => {
    let token;

    // 1. Verifica se o header Authorization existe e se começa com 'Bearer'
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Extrai o token, removendo 'Bearer ' (ex: 'Bearer tokenabc' -> 'tokenabc')
            token = req.headers.authorization.split(' ')[1];

            // 2. Decodifica o token usando a chave secreta
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // 3. Busca o usuário no DB pelo ID contido no token
            // Se o usuário ID 2 realmente existe no banco, esta linha deve funcionar.
            const user = await findUserById(decoded.userId);

            if (!user) {
                // Se a busca falhar ou retornar null (Usuário deletado ou ID errado no token)
                return res.status(401).json({ error: "Não autorizado, usuário não encontrado." });
            }

            // Anexa o usuário logado ao objeto da requisição (req.user)
            req.user = user;
            
            // Continua para o próximo middleware ou controller
            next();
        } catch (error) {
            // Captura erros de decodificação do JWT (token expirado ou modificado)
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
 * Deve ser usado DEPOIS do middleware 'protect'.
 */
const admin = (req, res, next) => {
    // req.user só existe se o middleware 'protect' passou
    if (req.user && req.user.role === 'Admin') {
        next();
    } else {
        return res.status(403).json({ error: "Não autorizado, requer permissão de Admin." });
    }
};

module.exports = { protect, admin };