// src/routes/users.js

const express = require('express');
const router = express.Router();

// Controlador
const UserController = require('../controllers/userController');

// Middlewares
const isAuthenticated = require('../middleware/authMiddleware');
const isAdministrator = require('../middleware/isAdministrator');

// ROTAS DE GERENCIAMENTO DE USUÁRIOS (CRUD)

// Criação de usuário
router.post('/', isAuthenticated, isAdministrator, UserController.createUser);

// Listagem de usuários
router.get('/', isAuthenticated, isAdministrator, UserController.getUsers);

// Busca por e-mail
router.get('/search', isAuthenticated, UserController.searchUser);

// Atualização de usuário
router.put('/:id', isAuthenticated, isAdministrator, UserController.updateUser);

// Exclusão de usuário
router.delete('/:id', isAuthenticated, isAdministrator, UserController.deleteUser);

module.exports = router;
