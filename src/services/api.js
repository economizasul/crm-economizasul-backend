// src/services/api.js

import axios from 'axios';

// 1. Cria uma instância base do axios
const api = axios.create({
    // A URL base é crucial. Se o backend estiver em outra porta/domínio, ajuste aqui.
    baseURL: '/api', 
    headers: {
        'Content-Type': 'application/json',
    },
});

// 2. Interceptor de Requisição: Adiciona o token JWT
api.interceptors.request.use((config) => {
    const userInfo = localStorage.getItem('userInfo');
    let token = null;
    
    try {
        if (userInfo) {
            token = JSON.parse(userInfo).token;
        }
    } catch (e) {
        console.error("Erro ao parsear userInfo do localStorage:", e);
    }

    if (token) {
        // ESSENCIAL: Adiciona o token ao cabeçalho de Autorização
        config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Interceptor de Resposta (Mantido)

export default api;