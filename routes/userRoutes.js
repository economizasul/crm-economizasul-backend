// routes/users.js (CORRIGIDO)

const express = require('express');
const router = express.Router();

// ⭐️ CORREÇÃO AQUI: Mudamos de '../controllers/UserController' para '../../controllers/UserController'
// Assumindo que: 
// Seu arquivo está em: /src/routes/users.js
// Seu controller está em: /controllers/UserController.js
// Subir duas pastas (../..) leva à raiz, onde a pasta 'controllers' existe.
const UserController = require('../../controllers/UserController'); 

// Assumindo que seu middleware está em src/middlewares
const isAuthenticated = require('../src/middlewares/isAuthenticated'); 
const isAdministrator = require('../src/middlewares/isAdministrator'); 

// ===================================
// ROTAS DE GERENCIAMENTO DE USUÁRIOS (CRUD)
// ===================================

// Rota de criação (POST)
router.post('/', isAuthenticated, isAdministrator, UserController.createUser);

// Rota de listagem e busca geral (GET /api/users ou /api/users?search=...)
router.get('/', isAuthenticated, isAdministrator, UserController.getUsers);

// Rota de busca específica (GET /api/users/search?email=...)
router.get('/search', isAuthenticated, UserController.searchUser);

// Rota de atualização (PUT /api/users/:id)
router.put('/:id', isAuthenticated, isAdministrator, UserController.updateUser);

// Rota de exclusão (DELETE /api/users/:id)
router.delete('/:id', isAuthenticated, isAdministrator, UserController.deleteUser);


module.exports = router;