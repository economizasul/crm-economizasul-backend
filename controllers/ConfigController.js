// controllers/ConfigController.js
const { pool } = require('../config/db');

class ConfigController {
  constructor() {
    this.getVendedores = this.getVendedores.bind(this);
    this.updateVendedor = this.updateVendedor.bind(this);
  }

  async getVendedores(req, res) {
    try {
      const result = await pool.query(`
        SELECT 
          id, name, email, role,
          relatorios_proprios_only, relatorios_todos,
          transferencia_leads, acesso_configuracoes
        FROM users 
        WHERE is_active = true 
        ORDER BY name ASC
      `);
      res.json(result.rows);
    } catch (err) {
      console.error('Erro ao listar vendedores:', err);
      res.status(500).json({ error: 'Erro ao carregar usuários' });
    }
  }

  async updateVendedor(req, res) {
    const { id } = req.params;
    const {
      relatorios_proprios_only = true,
      relatorios_todos = false,
      transferencia_leads = false,
      acesso_configuracoes = false
    } = req.body;

    try {
      const result = await pool.query(`
        UPDATE users 
        SET 
          relatorios_proprios_only = $1,
          relatorios_todos = $2,
          transferencia_leads = $3,
          acesso_configuracoes = $4
        WHERE id = $5 AND is_active = true
        RETURNING 
          id, name, email, role,
          relatorios_proprios_only, relatorios_todos,
          transferencia_leads, acesso_configuracoes
      `, [
        relatorios_proprios_only,
        relatorios_todos,
        transferencia_leads,
        acesso_configuracoes,
        id
      ]);

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error('Erro ao atualizar permissões:', err);
      res.status(500).json({ error: 'Erro ao salvar permissões' });
    }
  }
}

module.exports = new ConfigController();