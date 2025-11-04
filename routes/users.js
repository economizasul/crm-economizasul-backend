// routes/users.js

const express = require('express');
const router = express.Router();

// Controlador
const UserController = require('../controllers/userController');

// Middlewares
const { protect: isAuthenticated } = require('../middleware/authMiddleware');
const isAdministrator = require('../middleware/isAdministrator');

// ROTAS DE GERENCIAMENTO DE USUÁRIOS (CRUD)
router.post('/', isAuthenticated, isAdministrator, UserController.createUser);
router.get('/', isAuthenticated, isAdministrator, UserController.getUsers);
router.get('/search', isAuthenticated, UserController.searchUser);
router.put('/:id', isAuthenticated, isAdministrator, UserController.updateUser);
router.delete('/:id', isAuthenticated, isAdministrator, UserController.deleteUser);

module.exports = router;