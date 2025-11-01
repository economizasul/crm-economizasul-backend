// src/services/api.js

import axios from 'axios';

// 1. Cria uma instância base do axios
const api = axios.create({
    // Certifique-se de que a URL base está correta. 
    // Usar '/api' funciona bem se o frontend e o backend estiverem no mesmo domínio ou se você usa proxy.
    baseURL: '/api', 
    headers: {
        'Content-Type': 'application/json',
    },
});

// 2. Interceptor de Requisição: Adiciona o token JWT
api.interceptors.request.use((config) => {
    // Tenta buscar as informações do usuário, que contêm o token
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
        // Adiciona o token ao cabeçalho de Autorização (Bearer Token)
        config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
}, (error) => {
    return Promise.reject(error);
});

// 3. Interceptor de Resposta: Para lidar com 401/Sessão Expirada (Opcional, mas recomendado)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Se for 401 (Unauthorized), pode ser sessão expirada
        if (error.response && error.response.status === 401) {
            console.error("Sessão expirada. Redirecionando para login...");
            // Exemplo: window.location.href = '/login'; 
            // O seu AuthContext já deve lidar com isso, mas é uma camada de segurança.
        }
        return Promise.reject(error);
    }
);

export default api;