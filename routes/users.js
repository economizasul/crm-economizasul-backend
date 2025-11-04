// routes/users.js

const express = require('express');
const router = express.Router();
const path = require('path'); // Novo import!

// ⭐️ CORREÇÃO FINAL: Usamos 'path.join' para construir o caminho absoluto.
// dirname é o diretório do arquivo atual (routes), então subimos duas pastas 
// para chegar na raiz e encontrar a pasta 'controllers'.
const UserController = require(path.join(__dirname, '..', '..', 'controllers', 'UserController')); 

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