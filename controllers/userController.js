// controllers/UserController.js

// Usaremos as dependências diretamente aqui, conforme seu código
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

            // 3. Inserção no Banco de Dados
            const insertQuery = `
                INSERT INTO users (name, email, password_hash, phone, role, is_active, created_at)
                VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
                RETURNING ${SELECT_USER_FIELDS};
            `;
            const values = [name, email, hashedPassword, phone, role];

            const result = await pool.query(insertQuery, values);
            const newUser = result.rows[0];

            return res.status(201).json({ 
                success: true, 
                message: 'Usuário criado com sucesso.', 
                data: newUser 
            });

        } catch (error) {
            console.error('Erro no controller ao criar usuário:', error);
            // 23505 é o código de erro para violação de unique constraint (se aplicado a outros campos)
            if (error.code === '23505') { 
                return res.status(409).json({ success: false, message: 'E-mail ou telefone já cadastrado.' });
            }
            return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
        }
    }

    /**
     * @route GET /api/users
     * Lista todos os usuários ou filtra por nome/email. (Usado no CRUD/Listagem Admin)
     */
    async getUsers(req, res) {
        const { search } = req.query; // Termo genérico para busca

        try {
            let query = `SELECT ${SELECT_USER_FIELDS} FROM users`;
            const values = [];

            if (search) {
                // Busca por nome ou email de forma case-insensitive (ILIKE)
                query += ' WHERE name ILIKE $1 OR email ILIKE $1';
                values.push(`%${search}%`);
            }
            
            query += ' ORDER BY name ASC';

            const result = await pool.query(query, values);
            
            res.status(200).json({
                success: true,
                data: result.rows,
                count: result.rows.length
            });
            
        } catch (error) {
            console.error("Erro ao listar usuários:", error.message);
            res.status(500).json({ success: false, message: 'Erro interno do servidor ao listar.' });
        }
    }

    /**
     * @route GET /api/users/search?email=...&name=...
     * Busca um único usuário por nome ou email. (Mantido do seu código original)
     */
    async searchUser(req, res) {
        const { email, name } = req.query;
        
        if (!email && !name) {
            return res.status(400).json({ error: 'Forneça um nome ou e-mail para a busca.' });
        }

        try {
            let result;
            const selectFields = SELECT_USER_FIELDS; 
            
            if (email) {
                result = await pool.query(`SELECT ${selectFields} FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
            } else if (name) {
                result = await pool.query(`SELECT ${selectFields} FROM users WHERE name ILIKE $1`, [`%${name}%`]);
            } else {
                return res.status(400).json({ error: 'Parâmetro de busca não reconhecido.' });
            }
            
            const user = result.rows[0];

            if (!user) {
                return res.status(404).json({ error: "Usuário não encontrado." });
            }
            
            res.status(200).json(user);

        } catch (error) {
            console.error("Erro ao buscar usuário:", error.message);
            res.status(500).json({ error: 'Erro interno do servidor ao buscar.' });
        }
    }

    /**
     * @route PUT /api/users/:id
     * Atualizar um usuário (nome, email, phone, role, isActive).
     */
    async updateUser(req, res) {
        const { id } = req.params;
        const { name, email, phone, role, isActive } = req.body;
        
        // CRÍTICO: 'isActive' é boolean, não pode ser verificado com !isActive a menos que seja undefined ou null
        if (!name || !email || !phone || !role || typeof isActive !== 'boolean') {
            return res.status(400).json({ error: 'Por favor, forneça todos os campos obrigatórios (name, email, phone, role, isActive).' });
        }

        try {
            const result = await pool.query(
                `UPDATE users 
                SET name = $1, email = $2, phone = $3, role = $4, is_active = $5, updated_at = NOW()
                WHERE id = $6 RETURNING ${SELECT_USER_FIELDS}`,
                [name, email, phone, role, isActive, id] 
            );

            const updatedUser = result.rows[0];

            if (updatedUser) {
                res.status(200).json({ success: true, message: 'Usuário atualizado com sucesso.', data: updatedUser });
            } else {
                res.status(404).json({ success: false, message: 'Usuário não encontrado para atualização.' });
            }

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

        try {
            // Tentaremos deletar (ou desativar, dependendo da sua regra)
            const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
            
            if (result.rowCount === 0) {
                return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
            }

            res.status(200).json({ success: true, message: 'Usuário excluído com sucesso.' });

        } catch (error) {
            console.error("Erro ao deletar usuário:", error.message);
            res.status(500).json({ success: false, message: 'Erro interno do servidor ao excluir.' });
        }
    }
}

// Exporta a instância do Controller para ser usada nas rotas
module.exports = new UserController();