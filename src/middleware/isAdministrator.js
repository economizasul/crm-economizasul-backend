// src/middlewares/isAdministrator.js

/**
 * Middleware para verificar se o usuário autenticado é um administrador.
 * Assume que o middleware 'isAuthenticated' já rodou e adicionou req.user.
 */
const isAdministrator = (req, res, next) => {
    // Verifica se há um usuário e se o papel dele é 'admin'
    // O papel 'admin' deve ser consistente com o valor salvo no seu banco de dados
    if (req.user && req.user.role === 'admin') {
        // O usuário é um administrador, prossegue para a próxima função da rota
        next();
    } else {
        // O usuário não é admin ou não está autenticado corretamente
        // Retorna 403 Forbidden (Acesso Negado)
        return res.status(403).json({ 
            success: false, 
            message: 'Acesso negado. Esta ação requer privilégios de Administrador.' 
        });
    }
};

module.exports = isAdministrator;