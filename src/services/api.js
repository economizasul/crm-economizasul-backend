// src/services/api.js

import axios from 'axios';

// Base URL: usa VITE_API_URL se definida (Render/CICD), senão '/api' (mesmo host)
const baseURL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json'
  },
});

// Interceptor de requisição: incluir token JWT se existir
api.interceptors.request.use((config) => {
  try {
    const userInfo = localStorage.getItem('userInfo');
    if (userInfo) {
      const token = JSON.parse(userInfo).token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch (e) {
    console.error('Erro ao ler token do localStorage:', e);
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Interceptor de resposta: captura 401/403 e faz logout
api.interceptors.response.use((response) => {
  return response;
}, (error) => {
  const status = error?.response?.status;
  if (status === 401 || status === 403) {
    // Limpa credenciais locais e redireciona para login
    try {
      localStorage.removeItem('userInfo');
    } catch (e) {
      console.error('Erro ao limpar localStorage durante logout:', e);
    }
    // Redireciona (se estiver em browser)
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }
  return Promise.reject(error);
});

export default api;
