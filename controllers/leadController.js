// controllers/leadController.js

const { pool } = require('../config/db');
const axios = require('axios');

// Função auxiliar para formatar um lead
const formatLeadResponse = (lead) => {
    const formatted = {
        _id: lead.id,
        name: lead.name,
        phone: lead.phone,
        document: lead.document,
        address: lead.address,
        status: lead.status,
        origin: lead.origin,
        ownerId: lead.owner_id,
        email: lead.email,
        uc: lead.uc,
        avgConsumption: lead.avg_consumption,
        estimatedSavings: lead.estimated_savings,
        qsa: lead.qsa,
        notes: lead.notes,
        createdAt: lead.created_at,
        lastAttendance: lead.last_attendance,
        attendanceNotes: lead.attendance_notes,
        lat: lead.lat,
        lng: lead.lng,
    };
    return formatted;
};

// @desc    Cria um novo lead
// @route   POST /api/v1/leads
// @access  Private
const createLead = async (req, res) => {
    const userId = req.user.id;
    const {
        name, phone, document, address, status, origin, email,
        uc, avgConsumption, estimatedSavings, qsa, notes
    } = req.body;

    // Log dos dados recebidos para depuração
    console.log('Dados recebidos para criar lead:', {
        name, phone, document, address, status, origin, email,
        uc, avgConsumption, estimatedSavings, qsa, notes, userId
    });

    if (!name || !phone) {
        console.log('Validação falhou: name ou phone ausentes');
        return res.status(400).json({ error: "Nome e telefone do lead são obrigatórios." });
    }

    try {
        const result = await pool.query(
            `INSERT INTO leads (name, phone, document, address, status, origin, owner_id, email, uc, avg_consumption, estimated_savings, qsa, notes) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
            RETURNING *`,
            [
                name, phone, document || null, address || null, status || 'Para Contatar',
                origin || 'outros', userId, email || null, uc || null,
                parseFloat(avgConsumption) || null, parseFloat(estimatedSavings) || null,
                qsa || null, notes || null
            ]
        );

        console.log('Lead criado com sucesso:', result.rows[0]);
        const formattedLead = formatLeadResponse(result.rows[0]);
        res.status(201).json(formattedLead);
    } catch (error) {
        console.error('Erro ao criar lead:', error.message, error.stack);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Um lead com o telefone ou email fornecido já existe.' });
        }
        res.status(500).json({ error: "Erro interno do servidor ao criar lead.", details: error.message });
    }
};

// @desc    Lista todos os leads (Admin) ou leads próprios (User)
// @route   GET /api/v1/leads
// @access  Private
const getAllLeads = async (req, res) => {
    try {
        let queryText = 'SELECT * FROM leads';
        let queryParams = [];

        console.log('Usuário:', req.user);

        if (req.user.role && req.user.role !== 'Admin') {
            queryText += ' WHERE owner_id = $1';
            queryParams = [req.user.id];
            console.log('Filtrando leads para owner_id:', req.user.id);
        }

        queryText += ' ORDER BY created_at DESC';

        const result = await pool.query(queryText, queryParams);

        console.log('Leads encontrados:', result.rows.length);

        const formattedLeads = result.rows.map(formatLeadResponse);

        // Teste temporário: Forçar o header CORS
        res.set('Access-Control-Allow-Origin', 'https://crm-front-renderer.onrender.com');
        res.status(200).json(formattedLeads);
    } catch (error) {
        console.error('Erro ao buscar leads:', error.message, error.stack);
        res.status(500).json({ error: 'Erro interno do servidor ao buscar leads.', details: error.message });
    }
};

// @desc    Geocodifica endereço de um lead e salva lat/long usando Nominatim
// @route   POST /api/v1/leads/:id/geocode
// @access  Private
const geocodeLeadAddress = async (req, res) => {
    const { id } = req.params;
    const lead = await pool.query('SELECT * FROM leads WHERE id = $1', [id]);
    if (lead.rows.length === 0) {
        return res.status(404).json({ error: 'Lead não encontrado.' });
    }

    const { address } = lead.rows[0];
    if (!address) {
        return res.status(400).json({ error: 'Endereço não fornecido.' });
    }

    try {
        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: {
                q: address,
                format: 'json',
                addressdetails: 1,
                limit: 1,
            },
            headers: {
                'User-Agent': 'CRM-Pessoal/1.0 ', // Obrigatório para Nominatim
            },
        });

        if (response.data.length === 0) {
            return res.status(404).json({ error: 'Endereço não encontrado.' });
        }

        const { lat, lon } = response.data[0];
        await pool.query(
            'UPDATE leads SET lat = $1, lng = $2 WHERE id = $3',
            [parseFloat(lat), parseFloat(lon), id]
        );

        res.status(200).json({ message: 'Endereço geocodificado.', lat, lng });
    } catch (error) {
        console.error('Erro na geocodificação:', error.message);
        res.status(500).json({ error: 'Falha na geocodificação do endereço.' });
    }
};

// @desc    Cria evento de atendimento local para um lead
// @route   POST /api/v1/leads/:id/schedule-attendance
// @access  Private
const scheduleAttendance = async (req, res) => {
    const { id } = req.params;
    const { date, time, notes } = req.body; // Ex.: date: "2025-10-25", time: "14:00"

    const lead = await pool.query('SELECT * FROM leads WHERE id = $1', [id]);
    if (lead.rows.length === 0) {
        return res.status(404).json({ error: 'Lead não encontrado.' });
    }

    const attendanceTime = new Date(`${date}T${time}:00`).toISOString();
    try {
        await pool.query(
            'UPDATE leads SET last_attendance = $1, attendance_notes = $2 WHERE id = $3',
            [attendanceTime, notes, id]
        );

        res.status(201).json({ message: 'Atendimento agendado localmente.', attendanceTime });
    } catch (error) {
        console.error('Erro ao agendar atendimento:', error.message);
        res.status(500).json({ error: 'Falha ao agendar atendimento.' });
    }
};

module.exports = {
    createLead,
    getAllLeads,
    geocodeLeadAddress,
    scheduleAttendance,
};