// routes/configuracoes.js
const express = require('express');
const router = express.Router();
const ConfigController = require('../controllers/ConfigController');
const { protect } = require('../middleware/authMiddleware');

// Apenas usuários logados + admin check dentro do controller
router.use(protect);

router.get('/vendedores', ConfigController.getVendedores);
router.put('/vendedor/:id', ConfigController.updateVendedor);

module.exports = router;