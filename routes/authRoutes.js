const express = require('express');
const router = express.Router();
// Certifique-se de que este caminho está correto:
const authController = require('../controllers/authController');

// Rota de Registro - Mapeando para o nome correto da função (registerUser)
// POST /api/auth/register
router.post('/register', authController.registerUser);

// Rota de Login - Mapeando para o nome correto da função (loginUser)
// POST /api/auth/login
router.post('/login', authController.loginUser);

// Rota de Obter Usuário (Ex: /api/auth/me) - Se o Controller tiver essa função:
// const { protect } = require('../middleware/authMiddleware');
// router.get('/me', protect, authController.getMe); 

module.exports = router;
