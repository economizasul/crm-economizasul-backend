const { pool } = require('../config/db');

class Lead {
    // 1. Cria a tabela de Leads se não existir
    static async createTable() {
        // ATENÇÃO: Adicionamos o campo 'metadata' do tipo JSONB para armazenar 
        // dados complexos como anotações, endereço, consumo, etc., que vieram do Front.
        const query = `
            CREATE TABLE IF NOT EXISTS leads (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(20) NOT NULL, 
                document VARCHAR(50), 
                qsa VARCHAR(255), 
                address VARCHAR(255),
                status VARCHAR(50) DEFAULT 'Para Contatar', 
                origin VARCHAR(100),
                
                -- Campos extras (uc, consumo, economia) e as anotações
                metadata JSONB DEFAULT '{}', 

                seller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;
        try {
            await pool.query(query);
            console.log("Tabela 'leads' verificada/criada com sucesso.");
        } catch (error) {
            console.error("Erro ao criar tabela 'leads':", error);
            throw error;
        }
    }

    // 2. Cria um novo Lead
    // Parâmetros foram expandidos para incluir todos os campos do Frontend
    static async create({ name, phone, document, qsa, address, origin, status, sellerId, uc, avgConsumption, estimatedSavings, notes }) {
        
        // Agrupa os campos que não têm colunas próprias no 'metadata'
        const metadata = {
            uc: uc,
            avgConsumption: avgConsumption,
            estimatedSavings: estimatedSavings,
            notes: notes || [],
            qsa: qsa, // Adiciona qsa aqui também, por segurança, se preferir
            address: address // Adiciona address aqui, por segurança, se preferir
        };

        const query = `
            INSERT INTO leads (name, phone, document, address, status, origin, seller_id, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *;
        `;
        // Ajustamos os valores para coincidir com a nova query
        const values = [name, phone, document, address, status, origin, sellerId, JSON.stringify(metadata)];
        
        try {
            const result = await pool.query(query, values);
            // Retorna o primeiro item (o lead recém-criado)
            return result.rows[0]; 
        } catch (error) {
            console.error('Erro no modelo ao criar lead:', error);
            throw error;
        }
    }

    // 3. Busca TODOS os Leads (Ajustamos owner_id para seller_id)
    static async findAll() {
        const query = `
            SELECT * FROM leads ORDER BY created_at DESC;
        `;
        try {
            const result = await pool.query(query);
            return result.rows;
        } catch (error) {
            console.error('Erro no modelo ao buscar TODOS os leads:', error);
            throw error;
        }
    }


    // 4. Busca todos os Leads de um Dono Específico (Ajustamos owner_id para seller_id)
    static async findBySeller(sellerId) {
        const query = `
            SELECT * FROM leads WHERE seller_id = $1 ORDER BY created_at DESC;
        `;
        try {
            const result = await pool.query(query, [sellerId]);
            return result.rows;
        } catch (error) {
            console.error('Erro no modelo ao buscar leads por vendedor:', error);
            throw error;
        }
    }
    
    // 5. Busca Lead por ID
    static async findById(id) {
        const query = 'SELECT * FROM leads WHERE id = $1';
        try {
            const result = await pool.query(query, [id]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Erro no modelo ao buscar lead por ID:', error);
            throw error;
        }
    }

    // 6. Atualiza Lead (Aceita todos os novos campos e seller_id)
    static async update(id, { name, phone, document, qsa, address, origin, status, sellerId, uc, avgConsumption, estimatedSavings, notes }) {
         // Agrupa os campos que não têm colunas próprias no 'metadata'
        const metadata = {
            uc: uc,
            avgConsumption: avgConsumption,
            estimatedSavings: estimatedSavings,
            notes: notes || [],
            qsa: qsa,
            address: address
        };
        
        const query = `
            UPDATE leads
            SET 
                name = $1, 
                phone = $2, 
                document = $3, 
                address = $4, 
                status = $5, 
                origin = $6, 
                seller_id = $7, 
                metadata = $8,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $9
            RETURNING *;
        `;
        
        const values = [name, phone, document, address, status, origin, sellerId, JSON.stringify(metadata), id];
        
        try {
            const result = await pool.query(query, values);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Erro no modelo ao atualizar lead:', error);
            throw error;
        }
    }

    // 7. Atualiza APENAS o status (mantido)
    static async updateStatus(id, newStatus) {
        const query = `
            UPDATE leads
            SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *;
        `;
        const values = [newStatus, id];
        try {
            const result = await pool.query(query, values);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Erro no modelo ao atualizar status do lead:', error);
            throw error;
        }
    }

    // 8. Exclui Lead (mantido)
    static async delete(id) {
        const query = 'DELETE FROM leads WHERE id = $1 RETURNING *;';
        try {
            const result = await pool.query(query, [id]);
            return result.rowCount > 0;
        } catch (error) {
            console.error('Erro no modelo ao excluir lead:', error);
            throw error;
        }
    }
}

module.exports = Lead;
```eof

### Resumo das Mudanças

1.  **Remoção do `email`:** O Frontend não envia `email`, então ele foi removido das colunas e funções.
2.  **Novas Colunas na Tabela:** Adicionamos as colunas **`document`**, **`address`**, **`origin`** e, o mais importante, **`metadata`** (`JSONB`).
3.  **`JSONB` para Dados Complexos:** O campo **`metadata`** é usado para armazenar dados em formato JSON, como as anotações (`notes`), `uc`, `avgConsumption`, e `estimatedSavings`, simplificando a integração com o Frontend.
4.  **Renomeação:** `owner_id` foi renomeado para **`seller_id`** em toda a classe para ser mais claro no contexto do CRM (e o método de busca foi renomeado para `findBySeller`).
5.  **Ajuste nas Funções:** As funções `create` e `update` agora aceitam todos os novos campos enviados pelo Frontend e empacotam os dados complexos dentro do `metadata` antes de salvar.

---

### Próximo Passo: Controller e Rotas

Com o modelo de dados pronto para PostgreSQL, precisamos criar o **Controller** e as **Rotas** para executar as funções `create` (POST) e `findAll`/`findBySeller` (GET).

**Vamos criar o `LeadController.js` para processar as requisições?**