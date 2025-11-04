// controllers/ConfigController.js

class ConfigController {
  constructor() {
    this.getOrigins = this.getOrigins.bind(this);
    this.getLostReasons = this.getLostReasons.bind(this);
  }

  async getOrigins(req, res) {
    try {
      // Exemplo: buscar origens do banco ou retornar fixas
      const origins = [
        { id: 'facebook', name: 'Facebook' },
        { id: 'instagram', name: 'Instagram' },
        { id: 'google', name: 'Google' },
        { id: 'indicacao', name: 'Indicação' },
        { id: 'outros', name: 'Outros' }
      ];
      res.status(200).json({ success: true, data: origins });
    } catch (error) {
      console.error('Erro ao buscar origens:', error);
      res.status(500).json({ success: false, message: 'Erro interno.' });
    }
  }

  async getLostReasons(req, res) {
    try {
      const reasons = [
        { id: 'preco_alto', name: 'Preço Alto' },
        { id: 'concorrencia', name: 'Concorrência' },
        { id: 'sem_interesse', name: 'Sem Interesse' },
        { id: 'sem_retorno', name: 'Sem Retorno' },
        { id: 'outro', name: 'Outro' }
      ];
      res.status(200).json({ success: true, data: reasons });
    } catch (error) {
      console.error('Erro ao buscar motivos de perda:', error);
      res.status(500).json({ success: false, message: 'Erro interno.' });
    }
  }
}

module.exports = new ConfigController();