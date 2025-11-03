// controllers/ReportController.js

const { pool } = require('../config/db');
const Lead = require('../models/Lead'); // Importa o modelo Lead refatorado
// Ajuste de caminho de helpers (se o seu PDFGenerator estiver em outro local, restaure o caminho original)
let pdfHelpers;
try {
  pdfHelpers = require('../src/services/PDFGenerator');
} catch (e) {
  try {
    pdfHelpers = require('../services/PDFGenerator');
  } catch (ee) {
    console.warn('PDFGenerator não encontrado em ../src/services ou ../services — operações de exportação podem falhar.');
    pdfHelpers = {};
  }
}
const { generatePdfReport, generateCsvString } = pdfHelpers;
const { format } = require('date-fns');

// =============================================================
// FUNÇÃO AUXILIAR: Constrói os filtros de consulta (Mantida)
// =============================================================
const buildQueryFilters = (req, useLeadAlias = false) => {
    const { startDate, endDate, ownerId: queryOwnerId, origin } = req.query;
    const isAdmin = (req.user && req.user.role && typeof req.user.role === 'string' && req.user.role.toLowerCase() === 'admin');

    let finalOwnerId;
    if (isAdmin) {
        // Admin pode filtrar por qualquer um (incluindo ele mesmo, se ownerId for passado)
        finalOwnerId = queryOwnerId || undefined;
    } else {
        // Usuário comum filtra apenas pelos seus próprios leads
        finalOwnerId = req.user?.id;
    }

    const prefix = useLeadAlias ? 'l.' : '';
    let condition = `1=1`;
    const params = [];
    let index = 1;

    // 1. Filtro de Proprietário
    if (finalOwnerId) {
        // O prefixo 'l.' é necessário para queries com JOINs (como getSellerPerformance)
        condition += ` AND ${prefix}owner_id = $${index}`;
        params.push(finalOwnerId);
        index++;
    }

    // 2. Filtro de Data Inicial (created_at)
    if (startDate) {
        const sd = new Date(startDate);
        sd.setHours(0, 0, 0, 0);
        condition += ` AND ${prefix}created_at >= $${index}`;
        params.push(sd);
        index++;
    }

    // 3. Filtro de Data Final (created_at)
    if (endDate) {
        const ed = new Date(endDate);
        ed.setHours(23, 59, 59, 999);
        condition += ` AND ${prefix}created_at <= $${index}`;
        params.push(ed);
        index++;
    }

    // 4. Filtro de Origem
    if (origin) {
        condition += ` AND ${prefix}origin = $${index}`;
        params.push(origin);
        index++;
    }

    return { condition, params };
};


// =============================================================
// ENDPOINT PRINCIPAL DO DASHBOARD (MÉTRICAS) - OTIMIZADO
// =============================================================
exports.getDashboardData = async (req, res) => {
    try {
        console.log(`[ReportController] getDashboardData called user=${req.user?.id || 'anon'} query=${JSON.stringify(req.query)}`);
        
        // 1. Constrói os filtros
        const { condition: baseCondition, params: values } = buildQueryFilters(req, false);
        const { condition: sellerCondition, params: sellerValues } = buildQueryFilters(req, true);


        // 2. EXECUTA TODAS AS QUERIES EM PARALELO (Otimização CRÍTICA)
        const [
            simpleMetrics,
            timeMetrics,
            funnelData,
            sellerPerformance,
            lossReasons,
            originAnalysis
        ] = await Promise.all([
            Lead.getSimpleMetrics(baseCondition, values),
            Lead.getTimeMetrics(baseCondition, values),
            Lead.getFunnelData(baseCondition, values),
            Lead.getSellerPerformance(sellerCondition, sellerValues),
            Lead.getLossReasons(baseCondition, values),
            Lead.getOriginAnalysis(baseCondition, values) 
        ]);

        // Verifica se há dados suficientes (baseado em leads totais)
        const totalLeads = Number(simpleMetrics.total_leads || 0);

        if (totalLeads === 0) {
            console.log('[ReportController] No leads found for given filters -> returning 200 with empty dashboard structure');
            
            // CORREÇÃO CRÍTICA: Retorna 200 OK com uma estrutura vazia
            const emptyDashboard = {
                newLeads: 0,
                activeLeads: 0,
                conversionRate: '0%',
                avgResponseTime: 0,
                avgTimeToClose: 0,
                totalValueInNegotiation: 0,
                funnelData: [],
                sellerPerformance: [],
                originAnalysis: [],
                lossReasons: []
            };
            return res.status(200).json(emptyDashboard);
        }

        const totalWonLeads = Number(simpleMetrics.total_won_leads || 0);
        
        // 3. Consolida e formata os resultados
        const dashboard = {
            newLeads: totalLeads,
            activeLeads: Number(simpleMetrics.active_leads || 0),
            conversionRate: (totalLeads > 0 ? ((totalWonLeads / totalLeads) * 100).toFixed(1) : 0) + '%',
            avgResponseTime: Math.round(Number(timeMetrics.avg_response_time_minutes || 0)),
            avgTimeToClose: Math.round(Number(timeMetrics.avg_time_to_close_days || 0)), 
            totalValueInNegotiation: Number(simpleMetrics.total_value_in_negotiation || 0),
            
            funnelData, 
            
            // Formatação do Seller Performance (Calcula a Taxa de Conversão aqui)
            sellerPerformance: sellerPerformance.map(p => ({
                name: p.seller_name,
                totalLeads: Number(p.total_leads),
                wonLeads: Number(p.won_leads),
                activeLeads: Number(p.active_leads),
                conversionRate: (Number(p.total_leads) > 0 ? ((Number(p.won_leads) / Number(p.total_leads)) * 100).toFixed(1) : 0) + '%',
                avgTimeToClose: Math.round(Number(p.avg_time_to_close || 0))
            })),
            
            originAnalysis: originAnalysis.map(o => ({ 
                origin: o.origin,
                totalLeads: Number(o.total_leads),
                wonLeads: Number(o.won_leads),
                conversionRate: (Number(o.total_leads) > 0 ? ((Number(o.won_leads) / Number(o.total_leads)) * 100).toFixed(1) : 0) + '%',
            })),

            lossReasons: lossReasons.map(r => ({ reason: r.reason_for_loss, count: Number(r.count) })) 
        };

        console.log(`[ReportController] getDashboardData returning dashboard with ${totalLeads} leads`);
        return res.json(dashboard);

    } catch (error) {
        console.error('Erro CRÍTICO ao buscar dados do dashboard (getDashboardData):', error);
        return res.status(500).json({ error: 'Erro interno do servidor ao processar o dashboard.' });
    }
};

// =============================================================
// ENDPOINT DE EXPORTAÇÃO (CSV / PDF) - OTIMIZADO (Mantido)
// =============================================================
exports.exportReports = async (req, res) => {
    try {
        console.log(`[ReportController] exportReports called user=${req.user?.id || 'anon'} query=${JSON.stringify(req.query)}`);

        const { format: exportFormat } = req.query;

        // Reutiliza a função de filtro para garantir consistência
        const { condition: baseCondition, params: values } = buildQueryFilters(req, true); 

        let query = `
            SELECT 
                l.*,
                u.name as owner_name,
                EXTRACT(EPOCH FROM (l.date_won - l.created_at)) / 86400 AS time_to_close_days
            FROM leads l
            LEFT JOIN users u ON l.owner_id = u.id
            WHERE ${baseCondition}
            ORDER BY l.created_at DESC
        `;

        const result = await pool.query(query, values);
        const leads = result.rows || [];

        if (!leads || leads.length === 0) {
            console.log('[ReportController] exportReports -> no leads found, returning 204');
            return res.status(204).send();
        }

        // Lógica de exportação (Mantida)
        const filters = req.query; 
        
        if (exportFormat === 'csv') {
            if (typeof generateCsvString !== 'function') {
                console.error('generateCsvString não disponível.');
                return res.status(500).json({ error: 'Serviço CSV não disponível.' });
            }
            const csvString = await generateCsvString(leads);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="leads_report_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv"`);
            return res.send('\ufeff' + csvString);
        } else if (exportFormat === 'pdf') {
            if (typeof generatePdfReport !== 'function') {
                console.error('generatePdfReport não disponível.');
                return res.status(500).json({ error: 'Serviço PDF não disponível.' });
            }
            const pdfBuffer = await generatePdfReport(leads, filters);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="leads_report_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf"`);
            return res.send(pdfBuffer);
        } else {
            return res.status(400).json({ message: 'Formato de exportação inválido.' });
        }

    } catch (error) {
        console.error('Erro na exportação de relatórios:', error);
        return res.status(500).json({ error: 'Erro interno ao exportar relatórios.' });
    }
};