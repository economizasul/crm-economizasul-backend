const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Obtém o segredo do JWT do ambiente
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
    console.error("ERRO FATAL: JWT_SECRET não está definido no .env!");
    process.exit(1); // Encerra o app se o segredo estiver faltando
}

// @desc    Registrar um novo usuário
// @route   POST /api/auth/register
exports.register = async (req, res) => {
    const { name, email, password, role } = req.body;
    
    // Validação básica
    if (!name || !email || !password || !role) {
        return res.status(400).json({ msg: 'Por favor, preencha todos os campos obrigatórios.' });
    }

    try {
        // 1. Verificar se o usuário já existe
        const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (userExists.rows.length > 0) {
            return res.status(400).json({ msg: 'Usuário já registrado com este e-mail.' });
        }

        // 2. Hash da senha
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Inserir novo usuário
        const result = await pool.query(
            'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
            [name, email, hashedPassword, role]
        );

        const user = result.rows[0];

        // 4. Gerar token JWT e retornar
        const token = jwt.sign({ id: user.id, role: user.role }, jwtSecret, { expiresIn: '1d' });

        res.status(201).json({ 
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: token 
        });

    } catch (error) {
        console.error('Erro no registro de usuário:', error.message);
        res.status(500).send('Erro no servidor.');
    }
};

// @desc    Autenticar usuário e obter token
// @route   POST /api/auth/login
exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Buscar usuário pelo e-mail
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        // Se o usuário não for encontrado
        if (userResult.rows.length === 0) {
            // Retornar 401 para não indicar se o problema é o email ou a senha
            return res.status(401).json({ msg: 'Credenciais inválidas.' });
        }

        const user = userResult.rows[0];
        
        // 2. Comparar a senha fornecida com o hash armazenado
        // CORREÇÃO CRÍTICA AQUI: usamos bcrypt.compare
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            // Retornar 401 se a senha não corresponder ao hash
            return res.status(401).json({ msg: 'Credenciais inválidas.' });
        }

        // 3. Gerar token JWT
        const token = jwt.sign({ id: user.id, role: user.role }, jwtSecret, { expiresIn: '1d' });

        // 4. Sucesso: retornar dados do usuário e token
        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: token,
        });

    } catch (error) {
        console.error('Erro no login do usuário:', error.message);
        // Garante que o usuário recebe uma mensagem amigável em caso de falha interna
        res.status(500).send('Erro no servidor durante a autenticação.');
    }
};
