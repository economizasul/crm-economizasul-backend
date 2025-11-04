// routes/users.js

const express = require('express');
const router = express.Router();

// ⭐️ TENTATIVA DE CORREÇÃO FINAL 2.0: Subindo apenas um nível.
// Isso funcionaria se o Render considerasse '/opt/render/project/src/' a raiz do projeto.
const UserController = require('../src/controllers/UserController'); 

// Assumindo que seu middleware está em src/middlewares
const isAuthenticated = require('../middlewares/isAuthenticated'); 
const isAdministrator = require('../middlewares/isAdministrator'); 

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