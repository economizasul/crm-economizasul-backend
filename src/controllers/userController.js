// src/controllers/userController.js
// Controlador completo para gerenciamento de usuários (CRUD + busca)
// Todas as funções são exportadas corretamente com module.exports

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../../config/db'); // Ajuste o caminho se necessário
const User = require('../../models/User'); // Modelo User com métodos estáticos

// ===========================
// 🆕 CRIAR USUÁRIO (POST /api/v1/users)
// ===========================
const createUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
  }

  try {
    // Verifica se o email já existe
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Este email já está em uso.' });
    }

    // Hash da senha
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Cria o usuário no banco
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'User' // padrão: User
    });

    // Remove senha da resposta
    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).json({
      message: 'Usuário criado com sucesso.',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Erro ao criar usuário:', error.message);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// ===========================
// 📋 LISTAR TODOS OS USUÁRIOS (GET /api/v1/users)
// ===========================
const getUsers = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, created_at, updated_at FROM users ORDER BY name'
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao listar usuários:', error.message);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// ===========================
// 🔍 BUSCAR USUÁRIO POR TERMO (GET /api/v1/users/search?q=termo)
// ===========================
const searchUser = async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Digite pelo menos 2 caracteres para buscar.' });
  }

  try {
    const searchTerm = `%${q.trim()}%`;
    const result = await pool.query(
      `SELECT id, name, email, role FROM users 
       WHERE name ILIKE $1 OR email ILIKE $1 
       ORDER BY name LIMIT 10`,
      [searchTerm]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro na busca de usuário:', error.message);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// ===========================
// ✏️ ATUALIZAR USUÁRIO (PUT /api/v1/users/:id)
// ===========================
const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, password, role } = req.body;

  if (!name && !email && !password && !role) {
    return res.status(400).json({ error: 'Nenhum dado fornecido para atualização.' });
  }

  try {
    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (role) updates.role = role;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(password, salt);
    }

    const updatedUser = await User.update(id, updates);
    if (!updatedUser) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const { password: _, ...userWithoutPassword } = updatedUser;
    res.status(200).json({
      message: 'Usuário atualizado com sucesso.',
      user: userWithoutPassword
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Este email já está em uso.' });
    }
    console.error('Erro ao atualizar usuário:', error.message);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// ===========================
// 🗑️ EXCLUIR USUÁRIO (DELETE /api/v1/users/:id)
// ===========================
const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const wasDeleted = await User.delete(id);
    if (!wasDeleted) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    res.status(200).json({ message: 'Usuário excluído com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir usuário:', error.message);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// ===========================
// EXPORTA TODAS AS FUNÇÕES
// ===========================
module.exports = {
  createUser,
  getUsers,
  searchUser,
  updateUser,
  deleteUser
};