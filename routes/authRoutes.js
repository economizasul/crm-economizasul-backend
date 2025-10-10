// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController'); // Importa o controlador

// Rota 1: POST /api/auth/register
// Cria um novo usuário/vendedor
router.post('/register', AuthController.register);

// Rota 2: POST /api/auth/login
// Realiza o login e retorna o token JWT
router.post('/login', AuthController.login);

module.exports = router;