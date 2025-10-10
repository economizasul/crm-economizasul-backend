// routes/clientRoutes.js

const express = require('express');
const router = express.Router();
const ClientController = require('../controllers/ClientController');

// 1. Importa a função 'protect' do arquivo de middleware
const { protect } = require('../middleware/authMiddleware'); 

// 2. Aplica o middleware 'protect' em TODAS as rotas de clientes
router.get('/', protect, ClientController.getAllClients);         
router.get('/:id', protect, ClientController.getClientById);     
router.post('/', protect, ClientController.createClient);        
router.put('/:id', protect, ClientController.updateClient);      
router.delete('/:id', protect, ClientController.deleteClient);   

module.exports = router;