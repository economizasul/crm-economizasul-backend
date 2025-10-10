// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

// 1. Função que verifica se o Token existe e é válido
const protect = (req, res, next) => {
    let token;

    // O token é enviado no cabeçalho 'Authorization' como: "Bearer TOKEN_AQUI"
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            // Extrai o TOKEN da string "Bearer TOKEN_AQUI"
            token = req.headers.authorization.split(' ')[1];

            // Verifica e decodifica o token usando a chave secreta
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Opcional: Anexa os dados decodificados do usuário na requisição (ex: req.user.id)
            // Aqui vamos apenas passar para a próxima função (next())

            next(); // Prossegue para a próxima função (o Controlador)
        } catch (error) {
            console.error('Erro na validação do token:', error);
            return res.status(401).json({ message: 'Não autorizado, token falhou.' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Não autorizado, nenhum token.' });
    }
};


// 2. Função que verifica se o usuário tem a role (função) necessária
const admin = (req, res, next) => {
    // Para simplificar, vamos deixar esta função vazia por enquanto.
    // Em um cenário real, você decodificaria o token (como em 'protect') e checaria se req.user.role === 'admin'.
    
    // Como a rota de Clientes é a primeira a ser protegida, vamos usar apenas 'protect' por enquanto.
    next(); 
};


module.exports = { protect, admin };