// routes/users.js

const express = require('express');
const router = express.Router();

const UserController = require('../controllers/userController'); 

const isAuthenticated = require('../middlewares/authMiddleware'); // O nome do seu arquivo é authMiddleware.js ou isAuthenticated.js? Usando o nome mais provável
const isAdministrator = require('../middlewares/isAdministrator'); 

// ROTAS DE GERENCIAMENTO DE USUÁRIOS (CRUD)

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