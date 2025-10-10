// controllers/ClientController.js
const Client = require('../models/Client'); // Importa o Modelo de Cliente

class ClientController {
    // 1. Lógica para Criar um Novo Cliente (HTTP POST - JÁ EXISTENTE)
    static async createClient(req, res) {
        try {
            const newClient = await Client.create(req.body); 
            res.status(201).json({
                message: "Cliente criado com sucesso!",
                client: newClient
            });
        } catch (error) {
            console.error('Erro no controller ao criar cliente:', error);
            res.status(400).json({ error: error.message });
        }
    }

    // 2. Lógica para Listar Todos os Clientes (HTTP GET - JÁ EXISTENTE)
    static async getAllClients(req, res) {
        try {
            const clients = await Client.findAll();
            res.status(200).json({
                count: clients.length,
                clients: clients
            });
        } catch (error) {
            console.error('Erro no controller ao listar clientes:', error);
            res.status(500).json({ error: "Erro interno do servidor ao buscar clientes." });
        }
    }
    
    // 3. NOVO: Lógica para Buscar Cliente por ID (HTTP GET /:id)
    static async getClientById(req, res) {
        const { id } = req.params; // Captura o ID da URL
        try {
            const client = await Client.findById(id);
            if (!client) {
                return res.status(404).json({ error: "Cliente não encontrado." });
            }
            res.status(200).json(client);
        } catch (error) {
            console.error('Erro no controller ao buscar cliente por ID:', error);
            res.status(500).json({ error: "Erro interno do servidor." });
        }
    }

    // 4. NOVO: Lógica para Atualizar um Cliente (HTTP PUT /:id)
    static async updateClient(req, res) {
        const { id } = req.params; // ID do cliente a ser atualizado
        try {
            // Passa o ID e o corpo da requisição para o Modelo
            const updatedClient = await Client.update(id, req.body); 

            if (!updatedClient) {
                return res.status(404).json({ error: "Cliente não encontrado para atualização." });
            }
            res.status(200).json({
                message: "Cliente atualizado com sucesso!",
                client: updatedClient
            });
        } catch (error) {
            console.error('Erro no controller ao atualizar cliente:', error);
            res.status(400).json({ error: error.message });
        }
    }

    // 5. NOVO: Lógica para Deletar um Cliente (HTTP DELETE /:id)
    static async deleteClient(req, res) {
        const { id } = req.params;
        try {
            const deletedClient = await Client.delete(id);
            if (!deletedClient) {
                return res.status(404).json({ error: "Cliente não encontrado para exclusão." });
            }
            // 204 No Content é o código ideal para exclusão bem-sucedida sem corpo de resposta
            res.status(204).send(); 
        } catch (error) {
            console.error('Erro no controller ao deletar cliente:', error);
            res.status(500).json({ error: "Erro interno do servidor." });
        }
    }
}

module.exports = ClientController;