// backend/routes/userRoutes.js

const express = require('express');
const router = express.Router();

const { searchUser, updateUser } = require('../controllers/userController');
// CRÍTICO: Assume que authMiddleware existe e tem a função protect
const { protect } = require('../middleware/authMiddleware'); 
// CRÍTICO: O middleware de 'protect' deve verificar se o usuário é Admin.

// Rota de busca de usuário por nome ou e-mail
// É uma rota GET, pois está apenas buscando dados.
// É protegida por 'protect' para exigir login.
router.route('/search').get(protect, searchUser);

// Rota de atualização de usuário por ID
// É protegida por 'protect' para exigir login.
router.route('/:id').patch(protect, updateUser);


module.exports = router;