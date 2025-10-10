// routes/clientRoutes.js
const express = require('express');
const router = express.Router(); // Cria um roteador específico para Clientes
const ClientController = require('../controllers/ClientController'); // Importa o Controlador

// Rota 1: POST /api/clients
// Cria um novo cliente
router.post('/', ClientController.createClient);

// Rota 2: GET /api/clients
// Lista todos os clientes
router.get('/', ClientController.getAllClients);

// Exporta o roteador para ser usado no app.js
module.exports = router;