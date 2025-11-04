// routes/authRoutes.js

const express = require('express');
const router = express.Router();

// Controlador
const { registerUser, loginUser } = require('../controllers/authController');

// ROTAS DE AUTENTICAÇÃO
router.post('/register', registerUser); // Registro de novo usuário
router.post('/login', loginUser);       // Login de usuário

module.exports = router;