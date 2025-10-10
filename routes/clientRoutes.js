// routes/clientRoutes.js
const express = require('express');
const router = express.Router();
const ClientController = require('../controllers/ClientController');

// Rotas Sem ID (Coleção)

// Rota 1: POST /api/clients (Criação)
router.post('/', ClientController.createClient);

// Rota 2: GET /api/clients (Listagem de Todos)
router.get('/', ClientController.getAllClients);

// Rotas Com ID (Recurso Específico)

// Rota 3: GET /api/clients/:id (Busca por ID)
router.get('/:id', ClientController.getClientById);

// Rota 4: PUT /api/clients/:id (Atualização Completa)
router.put('/:id', ClientController.updateClient);

// Rota 5: DELETE /api/clients/:id (Exclusão)
router.delete('/:id', ClientController.deleteClient);

module.exports = router;