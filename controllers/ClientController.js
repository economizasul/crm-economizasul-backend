// controllers/ClientController.js
const Client = require('../models/Client'); // Importa o Modelo de Cliente

class ClientController {
    // 1. Lógica para Criar um Novo Cliente (HTTP POST)
    static async createClient(req, res) {
        try {
            // Os dados (name, email, phone) vêm do corpo da requisição (req.body)
            const newClient = await Client.create(req.body); 
            
            // 201 Created é o código de sucesso para criação de recurso
            res.status(201).json({
                message: "Cliente criado com sucesso!",
                client: newClient
            });
        } catch (error) {
            // Se o erro for de email duplicado, o código será 400 Bad Request
            console.error('Erro no controller ao criar cliente:', error);
            res.status(400).json({ error: error.message });
        }
    }

    // 2. Lógica para Listar Todos os Clientes (HTTP GET)
    static async getAllClients(req, res) {
        try {
            const clients = await Client.findAll();
            
            // 200 OK é o código de sucesso
            res.status(200).json({
                count: clients.length,
                clients: clients
            });
        } catch (error) {
            console.error('Erro no controller ao listar clientes:', error);
            res.status(500).json({ error: "Erro interno do servidor ao buscar clientes." });
        }
    }
}

module.exports = ClientController;