// controllers/ReportController.js

const Lead = require('../models/Lead');
const { pool } = require('../config/db'); 
const { generatePdfReport, generateCsvString } = require('../src/services/PDFGenerator'); // ✅ Caminho corrigido
const { format } = require('date-fns'); // Instale: npm install date-fns

// Lógica de Obtenção de Dados (função auxiliar para evitar repetição no controller)
const getFilteredLeadsWithSeller = async (filters) => {
    let query = `
        SELECT 
            l.*, 
            u.name as owner_name,
            EXTRACT(EPOCH FROM (l.date_won - l.created_at)) / 86400 AS time_to_close_days 
        FROM leads l
        JOIN users u ON l.owner_id = u.id
        WHERE 1=1
    `;
    const values = [];
    let valueIndex = 1;
    
    if (!filters.isAdmin) {
        query += ` AND l.owner_id = $${valueIndex}`;
        values.push(filters.ownerId);
        valueIndex++;
    }
    
    if (filters.ownerId && filters.isAdmin) {
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
// NOVO: ENDPOINT PRINCIPAL DO DASHBOARD (MÉTRICAS)
// =============================================================
exports.getDashboardData = async (req, res) => {
    try {
        const { startDate, endDate, ownerId, origin } = req.query;
        const isAdmin = req.user.role === 'admin';
        
        const finalOwnerId = !isAdmin ? req.user.id : ownerId;
        
        const filters = {
            startDate, endDate, 
            ownerId: finalOwnerId, 
            isAdmin, 
            origin
        };
        
        const leads = await getFilteredLeadsWithSeller(filters);

        const totalLeads = leads.length;
        const wonLeads = leads.filter(l => l.status === 'Ganho');
        const lostLeads = leads.filter(l => l.status === 'Perdido');
        const activeLeads = leads.filter(l => l.status !== 'Ganho' && l.status !== 'Perdido');
        const totalValueInNegotiation = leads
            .filter(l => ['Em Negociação', 'Proposta Enviada'].includes(l.status))
            .reduce((sum, l) => sum + (l.estimated_savings || 0), 0);
            
        const avgResponseTime = 32; 

        const funnelData = leads.reduce((acc, l) => {
            acc[l.status] = (acc[l.status] || 0) + 1;
            return acc;
        }, {});
        
        const performanceData = leads.reduce((acc, l) => {
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

        const sellerPerformance = Object.values(performanceData).map(p => ({
            name: p.name,
            totalLeads: p.totalLeads,
            wonLeads: p.wonLeads,
            activeLeads: p.activeLeads,
            conversionRate: (p.totalLeads > 0 ? (p.wonLeads / p.totalLeads * 100).toFixed(1) : 0) + '%',
            avgTimeToClose: p.wonCount > 0 ? (p.totalTimeToClose / p.wonCount).toFixed(0) : 0
        }));

        const lossReasons = lostLeads.reduce((acc, l) => {
            if (l.reason_for_loss) {
                acc[l.reason_for_loss] = (acc[l.reason_for_loss] || 0) + 1;
            }
            return acc;
        }, {});
        
        const dashboard = {
            newLeads: totalLeads,
            activeLeads: activeLeads.length,
            conversionRate: (totalLeads > 0 ? (wonLeads.length / totalLeads * 100).toFixed(1) : 0) + '%',
            avgResponseTime: avgResponseTime,
            totalValueInNegotiation: totalValueInNegotiation,
            
            funnelData: Object.keys(funnelData).map(status => ({ status, count: funnelData[status] })),
            sellerPerformance: sellerPerformance,
            
            originAnalysis: leads.reduce((acc, l) => {
                const originKey = l.origin || 'Desconhecida';
                if (!acc[originKey]) {
                    acc[originKey] = { origin: originKey, totalLeads: 0, wonLeads: 0 };
                }
                acc[originKey].totalLeads++;
                if (l.status === 'Ganho') {
                    acc[originKey].wonLeads++;
                }
                return acc;
            }, {}),
            
            lossReasons: Object.keys(lossReasons).map(reason => ({ reason, count: lossReasons[reason] }))
        };
        
        res.json(dashboard);
        
    } catch (error) {
        console.error('Erro ao buscar dados do dashboard:', error);
        res.status(500).json({ error: 'Erro interno ao processar relatórios.' });
    }
};

// =============================================================
// NOVO: ENDPOINT DE EXPORTAÇÃO (CSV e PDF)
// =============================================================
exports.exportReports = async (req, res) => {
    try {
        const { format, startDate, endDate, ownerId, origin } = req.query; 
        const isAdmin = req.user.role === 'admin';
        const finalOwnerId = !isAdmin ? req.user.id : ownerId;
        
        const filters = {
            startDate, endDate, 
            ownerId: finalOwnerId, 
            isAdmin, 
            origin
        };
        
        const leads = await getFilteredLeadsWithSeller(filters); 

        if (!leads || leads.length === 0) {
            return res.status(404).json({ message: 'Nenhum dado encontrado para exportação.' });
        }

        if (format === 'csv') {
            const csvString = await generateCsvString(leads);
            
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="leads_report_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv"`);
            res.send('\ufeff' + csvString);
            
        } else if (format === 'pdf') {
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
