// controllers/userController.js

// Usaremos as dependências diretamente aqui, conforme seu código
// ⭐️ CORRIGIDO: Caminho ajustado para a nova estrutura (../)
const { pool } = require('../config/db'); 
const bcrypt = require('bcryptjs'); 

const SALT_ROUNDS = 10;
const SELECT_USER_FIELDS = 'id, name, email, phone, role, is_active AS "isActive"';

class UserController {
    
    /**
     * @route POST /api/users
     * Cria um novo usuário (Requer permissão de Admin).
     */
    async createUser(req, res) {
        const { name, email, password, phone, role } = req.body;

        if (!name || !email || !password || !phone || !role) {
            return res.status(400).json({ success: false, message: 'Nome, e-mail, senha, telefone e papel (role) são obrigatórios.' });
        }

        try {
            // 1. Verificar se o usuário já existe
            const checkQuery = 'SELECT id FROM users WHERE email = $1;';
            const existingUser = await pool.query(checkQuery, [email]);

            if (existingUser.rows.length > 0) {
                return res.status(409).json({ success: false, message: 'E-mail já está em uso.' });
            }

            // 2. Hash da Senha
            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

            // 3. Inserir novo usuário
            const insertQuery = `
                INSERT INTO users (name, email, password, phone, role)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING ${SELECT_USER_FIELDS};
            `;
            const result = await pool.query(insertQuery, [name, email, hashedPassword, phone, role]);
            
            res.status(201).json({ success: true, user: result.rows[0] });

        } catch (error) {
            console.error("Erro ao criar usuário:", error.message);
            res.status(500).json({ success: false, message: 'Erro interno do servidor ao criar usuário.' });
        }
    }

    /**
     * @route GET /api/users
     * Lista todos os usuários ou filtra por query de busca. (Requer permissão de Admin).
     */
    async getUsers(req, res) {
        // A busca pode ser feita pelo nome, email ou phone
        const { search } = req.query; 
        
        // Verifica se o usuário logado é Administrador (middleware já deve ter feito isso)
        if (req.user.role !== 'Admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado. Apenas administradores podem listar usuários.' });
        }

        try {
            let query = `SELECT ${SELECT_USER_FIELDS} FROM users`;
            const values = [];
            
            if (search) {
                // Filtra por nome, e-mail ou telefone
                query += ` WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1`;
                values.push(`%${search}%`);
            }

            query += ` ORDER BY name;`;

            const result = await pool.query(query, values);
            res.status(200).json({ success: true, users: result.rows });

        } catch (error) {
            console.error("Erro ao listar usuários:", error.message);
            res.status(500).json({ success: false, message: 'Erro interno do servidor ao listar usuários.' });
        }
    }

    /**
     * @route GET /api/users/search?email=...
     * Busca um único usuário por e-mail. (Requer permissão de Admin).
     */
    async searchUser(req, res) {
        const { email } = req.query;

        // Apenas para Administradores
        if (req.user.role !== 'Admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        
        if (!email) {
            return res.status(400).json({ success: false, message: 'O parâmetro email é obrigatório.' });
        }

        try {
            const query = `SELECT ${SELECT_USER_FIELDS} FROM users WHERE email = $1;`;
            const result = await pool.query(query, [email]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
            }

            res.status(200).json({ success: true, user: result.rows[0] });

        } catch (error) {
            console.error("Erro ao buscar usuário por e-mail:", error.message);
            res.status(500).json({ success: false, message: 'Erro interno do servidor ao buscar usuário.' });
        }
    }


    /**
     * @route PUT /api/users/:id
     * Atualiza dados de um usuário. (Requer permissão de Admin).
     */
    async updateUser(req, res) {
        const { id } = req.params;
        const { name, email, phone, role, isActive, password } = req.body;
        
        // Apenas Administradores podem atualizar
        if (req.user.role !== 'Admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }

        try {
            let updateFields = [];
            const values = [];
            let valueIndex = 1;

            if (name) {
                updateFields.push(`name = $${valueIndex++}`);
                values.push(name);
            }
            if (email) {
                updateFields.push(`email = $${valueIndex++}`);
                values.push(email);
            }
            if (phone) {
                updateFields.push(`phone = $${valueIndex++}`);
                values.push(phone);
            }
            if (role) {
                updateFields.push(`role = $${valueIndex++}`);
                values.push(role);
            }
            // Verifica se a flag isActive foi fornecida (pode ser true ou false)
            if (typeof isActive !== 'undefined') {
                updateFields.push(`is_active = $${valueIndex++}`);
                values.push(isActive);
            }
            // Lida com a mudança de senha
            if (password) {
                const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
                updateFields.push(`password = $${valueIndex++}`);
                values.push(hashedPassword);
            }

            if (updateFields.length === 0) {
                return res.status(400).json({ success: false, message: 'Nenhum campo fornecido para atualização.' });
            }

            // Adiciona updated_at e o ID ao final
            updateFields.push(`updated_at = NOW()`);
            const updateQuery = `
                UPDATE users SET ${updateFields.join(', ')}
                WHERE id = $${valueIndex}
                RETURNING ${SELECT_USER_FIELDS};
            `;
            values.push(id);

            const result = await pool.query(updateQuery, values);
            
            if (result.rowCount === 0) {
                return res.status(404).json({ success: false, message: 'Usuário não encontrado ou nada foi alterado.' });
            }

            res.status(200).json({ success: true, message: 'Usuário atualizado com sucesso.', user: result.rows[0] });

        } catch (error) {
            console.error("Erro ao atualizar usuário:", error.message);
            if (error.code === '23505') { // Código de unique constraint
                return res.status(409).json({ success: false, message: 'Este e-mail ou telefone já está sendo usado por outra conta.' });
            }
            res.status(500).json({ success: false, message: 'Erro interno do servidor ao atualizar.' });
        }
    }

    /**
     * @route DELETE /api/users/:id
     * Deleta um usuário. (Geralmente, setamos is_active=FALSE ao invés de deletar)
     */
    async deleteUser(req, res) {
        const { id } = req.params;

        // Apenas Administradores podem deletar
        if (req.user.role !== 'Admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        
        try {
            // Tentaremos deletar
            const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
            
            if (result.rowCount === 0) {
                return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
            }

            res.status(200).json({ success: true, message: 'Usuário excluído com sucesso.' });

        } catch (error) {
            console.error("Erro ao deletar usuário:", error.message);
            res.status(500).json({ success: false, message: 'Erro interno do servidor ao deletar usuário.' });
        }
    }
}

// Cria uma instância e exporta os métodos ligados ao 'this'
module.exports = new UserController();