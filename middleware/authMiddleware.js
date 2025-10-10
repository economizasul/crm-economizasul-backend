// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const User = require('../models/User'); 

// Chave Secreta do JWT (Deve ser a mesma usada no UserController)
const JWT_SECRET = process.env.JWT_SECRET || 'chave_super_secreta_padrao';

// Middleware de Proteção de Rotas
const protect = async (req, res, next) => {
    let token;

    // 1. Verifica se o token está no cabeçalho
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            // Obtém o token do cabeçalho "Bearer <token>"
            token = req.headers.authorization.split(' ')[1];

            // 2. Verifica e decodifica o token
            const decoded = jwt.verify(token, JWT_SECRET);

            // 3. Anexa o ID do usuário à requisição (req.user)
            // Agora, qualquer controller que usar este middleware terá acesso a req.user.id
            req.user = await User.findById(decoded.id);

            if (!req.user) {
                return res.status(401).json({ error: 'Não autorizado, usuário não encontrado.' });
            }

            next(); // Prossegue para a próxima função (o Controller)

        } catch (error) {
            console.error(error);
            return res.status(401).json({ error: 'Não autorizado, token falhou.' });
        }
    }

    if (!token) {
        return res.status(401).json({ error: 'Não autorizado, token não encontrado.' });
    }
};

module.exports = { protect };