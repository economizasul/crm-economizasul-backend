// src/middleware/isAdministrator.js

/**
 * Middleware para verificar se o usuário autenticado é um administrador.
 * Assume que o middleware 'authMiddleware' já executou e adicionou req.user.
 */
const isAdministrator = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Acesso negado. Esta ação requer privilégios de Administrador.',
  });
};

module.exports = isAdministrator;
