// controllers/AuthController.js
const User = require('../models/User'); // Importa o Modelo de Usuário
const jwt = require('jsonwebtoken'); // Importa o JWT para criar tokens
// O dotenv será usado para ler a chave secreta que vamos configurar
require('dotenv').config(); 

// Chave Secreta para gerar o token. Lida da variável de ambiente!
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_nao_usar_em_prod';

class AuthController {
    // 1. Lógica para Registrar um Novo Vendedor/Admin (POST /api/auth/register)
    static async register(req, res) {
        const { name, email, password, role } = req.body;
        
        // Validação básica
        if (!name || !email || !password) {
            return res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
        }

        try {
            const newUser = await User.create({ name, email, password, role });
            
            // Cria o token de autenticação (JWT) que o vendedor usará para acessar a API
            const token = jwt.sign(
                { userId: newUser.id, role: newUser.role }, 
                JWT_SECRET, 
                { expiresIn: '1d' } // Token expira em 1 dia
            );

            // Resposta de sucesso
            res.status(201).json({
                message: "Usuário registrado com sucesso!",
                token,
                user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role }
            });

        } catch (error) {
            console.error('Erro no controller ao registrar usuário:', error);
            res.status(400).json({ error: error.message });
        }
    }

    // 2. Lógica para Login (POST /api/auth/login)
    static async login(req, res) {
        const { email, password } = req.body;
        
        try {
            const user = await User.findByEmail(email);

            // 1. Verifica se o usuário existe
            if (!user) {
                return res.status(401).json({ error: "Credenciais inválidas." });
            }

            // 2. Compara a senha (a senha do banco é criptografada)
            const isMatch = await User.comparePassword(password, user.password);

            if (!isMatch) {
                return res.status(401).json({ error: "Credenciais inválidas." });
            }

            // 3. Cria o token de autenticação (JWT)
            const token = jwt.sign(
                { userId: user.id, role: user.role }, 
                JWT_SECRET, 
                { expiresIn: '1d' }
            );

            // Resposta de sucesso
            res.status(200).json({
                message: "Login bem-sucedido!",
                token,
                user: { id: user.id, name: user.name, email: user.email, role: user.role }
            });

        } catch (error) {
            console.error('Erro no controller ao realizar login:', error);
            res.status(500).json({ error: "Erro interno do servidor." });
        }
    }
}

module.exports = AuthController;