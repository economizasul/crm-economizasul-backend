// routes/authRoutes.js

const express = require('express');
const router = express.Router();
// Certifique-se de que este caminho está correto:
const authController = require('../controllers/authController');

// Rota de Registro
// POST /api/auth/register
router.post('/register', authController.registerUser);

// Rota de Login
// POST /api/auth/login
router.post('/login', authController.loginUser);

// Rota de Obter Usuário (Ex: /api/auth/me) - Opcional, mas útil
// const { protect } = require('../middleware/authMiddleware');
// router.get('/me', protect, authController.getMe); 

module.exports = router;