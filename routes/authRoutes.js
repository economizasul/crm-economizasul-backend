const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Rota de Registro 
router.post('/register', authController.registerUser);

// Rota de Login 
router.post('/login', authController.loginUser);

module.exports = router;