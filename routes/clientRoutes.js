// routes/clientRoutes.js

const express = require('express');
const router = express.Router();
const ClientController = require('../src/controllers/ClientController');

const { protect } = require('../middleware/authMiddleware'); 

// ------------------------------------------------------------------
// ROTAS DE CLIENTES (CRUD) - TODAS PROTEGIDAS
// ------------------------------------------------------------------

router.get('/', protect, ClientController.getAllClients);         // Listar Clientes
router.get('/:id', protect, ClientController.getClientById);     // Buscar por ID
router.post('/', protect, ClientController.createClient);        // Criar Cliente
router.put('/:id', protect, ClientController.updateClient);      // Atualizar Cliente
router.delete('/:id', protect, ClientController.deleteClient);   // Excluir Cliente

module.exports = router;