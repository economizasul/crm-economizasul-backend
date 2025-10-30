// routes/configuracoes.js

const express = require('express');
const router = express.Router();

// CORREÇÃO: caminho correto + authorize
const { protect, authorize } = require('../middleware/authMiddleware');
const db = require('../config/db');

// LISTAR TODOS OS USUÁRIOS (exceto SuperAdmin, se existir)
router.get('/vendedores', protect, authorize('Admin'), async (req, res) => {
    try {
        const result = await db.query(
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
             WHERE role != 'SuperAdmin' 
             ORDER BY name ASC`
        );

        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao listar vendedores:', err);
        res.status(500).json({ error: 'Erro ao carregar usuários' });
    }
});

// ATUALIZAR PERMISSÕES DE UM USUÁRIO
router.put('/vendedor/:id', protect, authorize('Admin'), async (req, res) => {
    const { id } = req.params;
    const {
        relatorios_proprios_only = true,
        relatorios_todos = false,
        transferencia_leads = false,
        acesso_configuracoes = false
    } = req.body;

    try {
        const result = await db.query(
            `UPDATE users 
             SET 
                relatorios_proprios_only = $1,
                relatorios_todos = $2,
                transferencia_leads = $3,
                acesso_configuracoes = $4
             WHERE id = $5 AND role != 'SuperAdmin'
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
            return res.status(404).json({ error: 'Usuário não encontrado ou é SuperAdmin' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Erro ao atualizar permissões:', err);
        res.status(500).json({ error: 'Erro ao salvar permissões' });
    }
});

module.exports = router;