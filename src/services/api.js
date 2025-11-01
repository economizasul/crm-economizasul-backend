// src/services/api.js
import axios from 'axios';

// ==============================================
// 🔧 Define a URL base dinamicamente
// ==============================================
// 1. Em produção (Render Frontend): usa a variável de ambiente VITE_API_URL
// 2. Em ambiente local: fallback para http://localhost:10000
// ==============================================

const API_BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:10000';

// ✅ Cria instância do Axios com headers padrão
const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`, // garante prefixo da API
  headers: {
    'Content-Type': 'application/json',
  },
});

// ✅ Intercepta requisições e adiciona o token de autenticação
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
