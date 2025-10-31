// controllers/ReportController.js

const Lead = require('../models/Lead');
const { pool } = require('../config/db'); 
const { generatePdfReport, generateCsvString } = require('../src/services/PDFGenerator');
const { format } = require('date-fns');

// Lógica de Obtenção de Dados (função auxiliar para evitar repetição no controller)
const getFilteredLeadsWithSeller = async (filters) => {
    let query = `
        SELECT 
            l.*, 
            u.name as owner_name,
            EXTRACT(EPOCH FROM (l.date_won - l.created_at)) / 86400 AS time_to_close_days 
        FROM leads l
        LEFT JOIN users u ON l.owner_id = u.id 
        WHERE 1=1
    `;
    const values = [];
    let valueIndex = 1;
    
    // Se não for Admin, ou se o Admin está filtrando por um vendedor específico
    if (!filters.isAdmin || filters.ownerId) {
         query += ` AND l.owner_id = $${valueIndex}`;
         values.push(filters.ownerId);
         valueIndex++;
    }
    
    if (filters.startDate) {
        query += ` AND l.created_at >= $${valueIndex}`;
        values.push(filters.startDate);
        valueIndex++;
    }
    if (filters.endDate) {
        const endDay = new Date(filters.endDate);
        endDay.setHours(23, 59, 59, 999);
        query += ` AND l.created_at <= $${valueIndex}`;
        values.push(endDay);
        valueIndex++;
    }
    
    if (filters.origin) {
        query += ` AND l.origin = $${valueIndex}`;
        values.push(filters.origin);
        valueIndex++;
    }

    query += ` ORDER BY l.created_at DESC`;
    
    const result = await pool.query(query, values);
    return result.rows;
};

// =============================================================
// ENDPOINT PRINCIPAL DO DASHBOARD (MÉTRICAS)
// =============================================================
exports.getDashboardData = async (req, res) => {
    try {
        const { startDate, endDate, ownerId, origin } = req.query;
        
        // Garante que a checagem de Admin funcione (minúsculas)
        const isAdmin = req.user.role.toLowerCase() === 'admin';
        
        // Define o filtro de ownerId. Se Admin, permite ownerId do query, senão força o ID do usuário.
        const finalOwnerId = isAdmin && ownerId ? ownerId : req.user.id; 
        
        const filters = {
            startDate, endDate, 
            ownerId: finalOwnerId, 
            isAdmin, 
            origin
        };
        
        const leads = await getFilteredLeadsWithSeller(filters);
        
        const totalLeads = leads.length;

        // --- Métrica Básicas ---
        const wonLeads = leads.filter(l => l.status === 'Ganho');
        const lostLeads = leads.filter(l => l.status === 'Perdido');
        const activeLeads = leads.filter(l => l.status !== 'Ganho' && l.status !== 'Perdido');
        
        const totalValueInNegotiation = leads
            .filter(l => ['Em Negociação', 'Proposta Enviada'].includes(l.status))
            .reduce((sum, l) => sum + (l.estimated_savings || 0), 0);
            
        // Valor estático
        const avgResponseTime = 32; 

        // --- Análise de Funil (Converte para Array) ---
        const funnelDataObj = leads.reduce((acc, l) => {
            acc[l.status] = (acc[l.status] || 0) + 1;
            return acc;
        }, {});
        const funnelData = Object.keys(funnelDataObj).map(status => ({ status, count: funnelDataObj[status] }));

        // --- Análise de Performance (Converte para Array) ---
        const performanceDataObj = leads.reduce((acc, l) => {
            if (!acc[l.owner_id]) {
                acc[l.owner_id] = { name: l.owner_name, totalLeads: 0, wonLeads: 0, activeLeads: 0, totalTimeToClose: 0, wonCount: 0 };
            }
            acc[l.owner_id].totalLeads++;
            if (l.status === 'Ganho') {
                acc[l.owner_id].wonLeads++;
                acc[l.owner_id].wonCount++;
                acc[l.owner_id].totalTimeToClose += l.time_to_close_days || 0;
            }
            if (l.status !== 'Ganho' && l.status !== 'Perdido') {
                acc[l.owner_id].activeLeads++;
            }
            return acc;
        }, {});

        const sellerPerformance = Object.values(performanceDataObj).map(p => ({
            name: p.name,
            totalLeads: p.totalLeads,
            wonLeads: p.wonLeads,
            activeLeads: p.activeLeads,
            conversionRate: (p.totalLeads > 0 ? (p.wonLeads / p.totalLeads * 100).toFixed(1) : 0) + '%',
            avgTimeToClose: p.wonCount > 0 ? (p.totalTimeToClose / p.wonCount).toFixed(0) : 0
        }));

        // --- Análise de Origem (Converte para Array) ---
        const originAnalysisObj = leads.reduce((acc, l) => {
            const originKey = l.origin || 'Desconhecida';
            if (!acc[originKey]) {
                acc[originKey] = { origin: originKey, totalLeads: 0, wonLeads: 0 };
            }
            acc[originKey].totalLeads++;
            if (l.status === 'Ganho') {
                acc[originKey].wonLeads++;
            }
            return acc;
        }, {});
        const originAnalysis = Object.values(originAnalysisObj);

        // --- Razões de Perda (Converte para Array) ---
        const lossReasonsObj = lostLeads.reduce((acc, l) => {
            if (l.reason_for_loss) {
                acc[l.reason_for_loss] = (acc[l.reason_for_loss] || 0) + 1;
            }
            return acc;
        }, {});
        const lossReasons = Object.keys(lossReasonsObj).map(reason => ({ reason, count: lossReasonsObj[reason] }));
        
        // --- Objeto Final do Dashboard (TODAS AS CHAVES GARANTIDAS) ---
        const dashboard = {
            newLeads: totalLeads,
            activeLeads: activeLeads.length,
            conversionRate: (totalLeads > 0 ? (wonLeads.length / totalLeads * 100).toFixed(1) : 0) + '%',
            avgResponseTime: avgResponseTime,
            totalValueInNegotiation: totalValueInNegotiation,
            
            // Todas essas chaves agora garantem um Array [] mesmo se leads estiver vazio.
            funnelData: funnelData,
            sellerPerformance: sellerPerformance,
            originAnalysis: originAnalysis,
            lossReasons: lossReasons
        };
        
        res.json(dashboard);
        
    } catch (error) {
        console.error('Erro ao buscar dados do dashboard:', error);
        // Garante que o frontend receba 500 em caso de erro, evitando tela branca
        res.status(500).json({ error: 'Erro interno ao processar relatórios.' });
    }
};

// =============================================================
// ENDPOINT DE EXPORTAÇÃO (CSV e PDF)
// =============================================================
exports.exportReports = async (req, res) => {
    try {
        const { format: exportFormat, startDate, endDate, ownerId, origin } = req.query; 
        
        // Garante que a checagem de Admin funcione (minúsculas)
        const isAdmin = req.user.role.toLowerCase() === 'admin';
        
        const finalOwnerId = isAdmin && ownerId ? ownerId : req.user.id;
        
        const filters = {
            startDate, endDate, 
            ownerId: finalOwnerId, 
            isAdmin, 
            origin
        };
        
        const leads = await getFilteredLeadsWithSeller(filters); 

        if (!leads || leads.length === 0) {
            // Se não houver dados para exportar, retorna 404/mensagem
            return res.status(404).json({ message: 'Nenhum dado encontrado para exportação.' });
        }

        if (exportFormat === 'csv') {
            const csvString = await generateCsvString(leads);
            
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="leads_report_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv"`);
            // Adiciona o BOM (Byte Order Mark) para garantir caracteres UTF-8 corretos no Excel
            res.send('\ufeff' + csvString); 
            
        } else if (exportFormat === 'pdf') {
            const pdfBuffer = await generatePdfReport(leads, filters); 
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="leads_report_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf"`);
            return res.send(pdfBuffer);
            
        } else {
            return res.status(400).json({ message: 'Formato de exportação inválido.' });
        }
        
    } catch (error) {
        console.error('Erro na exportação de relatórios:', error);
        res.status(500).json({ error: 'Erro interno ao exportar relatórios.' });
    }
};