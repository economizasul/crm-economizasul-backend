// routes/clientRoutes.js

const express = require('express');
const router = express.Router();
const ClientController = require('../controllers/ClientController');

// IMPORTAÇÃO DO MIDDLEWARE DE SEGURANÇA
const { protect } = require('../middleware/authMiddleware'); 

// ------------------------------------------------------------------
// APLICAÇÃO DO MIDDLEWARE NAS ROTAS (CRUD)
// ------------------------------------------------------------------

router.get('/', protect, ClientController.getAllClients);         // Listar Clientes
router.get('/:id', protect, ClientController.getClientById);     // Buscar por ID
router.post('/', protect, ClientController.createClient);        // Criar Cliente
router.put('/:id', protect, ClientController.updateClient);      // Atualizar Cliente
router.delete('/:id', protect, ClientController.deleteClient);   // Excluir Cliente

module.exports = router;