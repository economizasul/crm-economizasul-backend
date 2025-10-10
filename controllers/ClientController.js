// routes/clientRoutes.js

const express = require('express');
const router = express.Router();
const ClientController = require('../controllers/ClientController');

// 1. IMPORTAÇÃO DO MIDDLEWARE (ADICIONAR NO TOPO)
// Importa a função 'protect' do arquivo que acabamos de criar
const { protect } = require('../middleware/authMiddleware'); 

// ------------------------------------------------------------------
// 2. APLICAÇÃO DO MIDDLEWARE NAS ROTAS
// O 'protect' é inserido como o SEGUNDO argumento antes do Controller.
// Se o token falhar, ele interrompe a requisição antes de chegar ao Controller.
// ------------------------------------------------------------------

router.get('/', protect, ClientController.getAllClients);         // Listar Clientes
router.get('/:id', protect, ClientController.getClientById);     // Buscar por ID
router.post('/', protect, ClientController.createClient);        // Criar Cliente
router.put('/:id', protect, ClientController.updateClient);      // Atualizar Cliente
router.delete('/:id', protect, ClientController.deleteClient);   // Excluir Cliente

module.exports = router;