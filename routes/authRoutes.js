//routes/authRoutes.js

const express = require('express');
const router = express.Router();

const { registerUser, loginUser } = require('../controllers/authController');

//Rota de Registro 
router.post('/register', registerUser);
//Rota de Login 
router.post('/login', loginUser);

module.exports = router;