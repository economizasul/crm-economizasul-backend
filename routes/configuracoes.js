// routes/configuracoes.js

const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware'); // Usar adminOnly (já existe)
const { pool } = require('../config/db'); // Usar pool direto

// LISTAR TODOS OS USUÁRIOS (exceto SuperAdmin, se existir)
router.get('/vendedores', protect, adminOnly, async (req, res) => {
    console.log('GET /vendedores - User:', req.user?.email, 'Role:', req.user?.role); // DEBUG
    
    try {
        const result = await pool.query(
            `SELECT 
                id, 
                name, 
                email, 
                role, 
                relatorios_proprios_only, 
                relatorios_todos, 
                transferencia_leads,
                acesso_configuracoes
             FROM users 
             WHERE is_active = true 
             ORDER BY name ASC` // Removido filtro role (para listar todos)
        );

        console.log('Query result rows:', result.rows.length); // DEBUG

        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao listar vendedores:', err.message); // DEBUG
        res.status(500).json({ error: 'Erro ao carregar usuários: ' + err.message });
    }
});

// ATUALIZAR PERMISSÕES DE UM USUÁRIO
router.put('/vendedor/:id', protect, adminOnly, async (req, res) => {
    console.log('PUT /vendedor - ID:', req.params.id, 'Body:', req.body); // DEBUG
    
    const { id } = req.params;
    const {
        relatorios_proprios_only = true,
        relatorios_todos = false,
        transferencia_leads = false,
        acesso_configuracoes = false
    } = req.body;

    try {
        const result = await pool.query(
            `UPDATE users 
             SET 
                relatorios_proprios_only = $1,
                relatorios_todos = $2,
                transferencia_leads = $3,
                acesso_configuracoes = $4
             WHERE id = $5 AND is_active = true
             RETURNING 
                id, name, email, role,
                relatorios_proprios_only, relatorios_todos,
                transferencia_leads, acesso_configuracoes`,
            [
                relatorios_proprios_only,
                relatorios_todos,
                transferencia_leads,
                acesso_configuracoes,
                id
            ]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        console.log('Update success:', result.rows[0]); // DEBUG

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Erro ao atualizar permissões:', err.message); // DEBUG
        res.status(500).json({ error: 'Erro ao salvar permissões: ' + err.message });
    }
});

module.exports = router;