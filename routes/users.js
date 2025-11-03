// src/routes/users.js

const express = require('express');
const router = express.Router();
// Ajuste o caminho para o seu controller
const UserController = require('../../controllers/UserController'); 

// Assume que você tem este middleware configurado:
const isAuthenticated = require('../middlewares/isAuthenticated'); // Ou use o seu middleware atual

// Rota de criação de usuário (protegida por autenticação)
// Idealmente, você teria um middleware isAdministrator aqui também.
router.post('/', isAuthenticated, UserController.createUser);

// Outras rotas (GET, PUT, DELETE) virão depois...

module.exports = router;