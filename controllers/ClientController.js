// controllers/ClientController.js

const Client = require('../../models/Client'); // <-- CORRIGIDO: Passa a subir dois níveis (../../)

class ClientController {
    // 1. Criar Cliente (POST /api/clients)
    static async createClient(req, res) {
        // ID temporário 1
        const owner_id = 1; 
        const { name, email, phone } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: "O nome do cliente é obrigatório." });
        }

        try {
            const newClient = await Client.create({ name, email, phone, owner_id });
            res.status(201).json({ 
                message: "Cliente criado com sucesso!", 
                client: newClient 
            });
        } catch (error) {
            console.error('Erro ao criar cliente:', error);
            res.status(500).json({ error: 'Erro interno do servidor ao criar cliente.' });
        }
    }

    // 2. Listar Todos os Clientes (GET /api/clients)
    static async getAllClients(req, res) {
        try {
            const clients = await Client.findAll();
            res.status(200).json(clients);
        } catch (error) {
            console.error('Erro ao listar clientes:', error);
            res.status(500).json({ error: 'Erro interno do servidor ao buscar clientes.' });
        }
    }

    // 3. Buscar Cliente por ID (GET /api/clients/:id)
    static async getClientById(req, res) {
        const { id } = req.params;

        try {
            const client = await Client.findById(id);
            
            if (!client) {
                return res.status(404).json({ error: "Cliente não encontrado." });
            }

            res.status(200).json(client);
        } catch (error) {
            console.error('Erro ao buscar cliente por ID:', error);
            res.status(500).json({ error: 'Erro interno do servidor ao buscar cliente.' });
        }
    }

    // 4. Atualizar Cliente (PUT /api/clients/:id)
    static async updateClient(req, res) {
        const { id } = req.params;
        const { name, email, phone } = req.body;

        try {
            const updatedClient = await Client.update(id, { name, email, phone });

            if (!updatedClient) {
                return res.status(404).json({ error: "Cliente não encontrado." });
            }

            res.status(200).json({ 
                message: "Cliente atualizado com sucesso!", 
                client: updatedClient 
            });
        } catch (error) {
            console.error('Erro ao atualizar cliente:', error);
            res.status(500).json({ error: 'Erro interno do servidor ao atualizar cliente.' });
        }
    }

    // 5. Excluir Cliente (DELETE /api/clients/:id)
    static async deleteClient(req, res) {
        const { id } = req.params;

        try {
            const wasDeleted = await Client.delete(id);

            if (!wasDeleted) {
                return res.status(404).json({ error: "Cliente não encontrado." });
            }

            res.status(200).json({ message: "Cliente excluído com sucesso." });
        } catch (error) {
            console.error('Erro ao excluir cliente:', error);
            res.status(500).json({ error: 'Erro interno do servidor ao excluir cliente.' });
        }
    }
}

module.exports = ClientController;