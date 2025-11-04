// routes/users.js
// Arquivo movido para a raiz do projeto (fora de src/)
// Todos os caminhos de require atualizados

const express = require('express');
const router = express.Router();

// === CONTROLADOR ===
const UserController = require('../controllers/userController');

// === MIDDLEWARES ===
// authMiddleware.js exporta { protect } → importamos como isAuthenticated
const { protect: isAuthenticated } = require('../middleware/authMiddleware');

// isAdministrator.js exporta a função diretamente
const isAdministrator = require('../middleware/isAdministrator');

// === ROTAS DE GERENCIAMENTO DE USUÁRIOS (CRUD) ===

// POST   /api/v1/users → Criar usuário (apenas Admin)
router.post('/', isAuthenticated, isAdministrator, UserController.createUser);

// GET    /api/v1/users → Listar todos os usuários (apenas Admin)
router.get('/', isAuthenticated, isAdministrator, UserController.getUsers);

// GET    /api/v1/users/search?q=termo → Buscar usuário por nome/email
router.get('/search', isAuthenticated, UserController.searchUser);

// PUT    /api/v1/users/:id → Atualizar usuário (apenas Admin)
router.put('/:id', isAuthenticated, isAdministrator, UserController.updateUser);

// DELETE /api/v1/users/:id → Excluir usuário (apenas Admin)
router.delete('/:id', isAuthenticated, isAdministrator, UserController.deleteUser);

// === EXPORTAÇÃO ===
module.exports = router;