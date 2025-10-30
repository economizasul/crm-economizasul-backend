// routes/configuracoes.js
const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { pool } = require('../config/db');

// Listar vendedores com permissões
router.get('/vendedores', protect, adminOnly, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                id, name, email, role,
                relatorios_proprios_only,
                relatorios_todos,
                transferencia_leads
            FROM users 
            WHERE role IN ('user', 'Admin')
            ORDER BY name
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao carregar vendedores' });
    }
});

// Atualizar permissões
router.put('/vendedor/:id', protect, adminOnly, async (req, res) => {
    const { id } = req.params;
    const {
        relatorios_proprios_only = true,
        relatorios_todos = false,
        transferencia_leads = false
    } = req.body;

    // Garante que não tenha ambas as opções de relatório ativas
    const finalRelProprios = relatorios_todos ? false : relatorios_proprios_only;
    const finalRelTodos = relatorios_todos;

    try {
        const result = await pool.query(`
            UPDATE users SET
                relatorios_proprios_only = $1,
                relatorios_todos = $2,
                transferencia_leads = $3
            WHERE id = $4
            RETURNING id, name, email
        `, [finalRelProprios, finalRelTodos, transferencia_leads, id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao salvar permissões' });
    }
});

module.exports = router;