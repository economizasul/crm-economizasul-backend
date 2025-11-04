// src/middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const pool = require('../db'); // ajuste: agora o app.js está na raiz

// =============================================================
// FUNÇÃO AUXILIAR: Buscar usuário por ID
// =============================================================
const findUserById = async (id) => {
  try {
    const userIdInt = parseInt(id, 10);
    const result = await pool.query(
      `
      SELECT 
        id, name, email, role, 
        relatorios_proprios_only,
        relatorios_todos,
        transferencia_leads,
        acesso_configuracoes
      FROM users 
      WHERE id = $1 AND is_active = true
    `,
      [userIdInt]
    );
    return result.rows[0];
  } catch (error) {
    console.error("Erro ao buscar usuário (findUserById):", error.message);
    return null;
  }
};

// =============================================================
// FUNÇÃO protect (autentica e anexa o usuário ao req.user)
// =============================================================
const protect = async (req, res, next) => {
  let token;

  try {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      console.warn("❌ Nenhum token de autorização fornecido");
      return res.status(401).json({ error: "Token de autorização não fornecido." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await findUserById(decoded.id || decoded.userId);

    if (!user) {
      console.warn("⚠️ Token válido, mas usuário não encontrado no banco.");
      return res.status(401).json({ error: "Usuário não encontrado ou inativo." });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("❌ Erro na verificação do token JWT:", error.message);
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
};

module.exports = protect;
