// controllers/ReportController.js

const { pool } = require('../config/db');
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
// FUNÇÃO AUXILIAR: Lógica de Obtenção de Dados (robusta)
// =============================================================
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

  if (filters.ownerId) {
    query += ` AND l.owner_id = $${valueIndex}`;
    values.push(filters.ownerId);
    valueIndex++;
  }

  if (filters.startDate) {
    // assume startDate string YYYY-MM-DD — add time start of day
    const sd = new Date(filters.startDate);
    sd.setHours(0, 0, 0, 0);
    query += ` AND l.created_at >= $${valueIndex}`;
    values.push(sd);
    valueIndex++;
  }

  if (filters.endDate) {
    const ed = new Date(filters.endDate);
    ed.setHours(23, 59, 59, 999);
    query += ` AND l.created_at <= $${valueIndex}`;
    values.push(ed);
    valueIndex++;
  }

  if (filters.origin) {
    query += ` AND l.origin = $${valueIndex}`;
    values.push(filters.origin);
    valueIndex++;
  }

  query += ` ORDER BY l.created_at DESC`;

  try {
    const result = await pool.query(query, values);
    return result.rows || [];
  } catch (error) {
    console.error("Erro na consulta SQL (getFilteredLeadsWithSeller):", error);
    throw error;
  }
};

// =============================================================
// ENDPOINT PRINCIPAL DO DASHBOARD (MÉTRICAS)
// =============================================================
exports.getDashboardData = async (req, res) => {
  try {
    console.log(`[ReportController] getDashboardData called user=${req.user?.id || 'anon'} query=${JSON.stringify(req.query)}`);

    const { startDate, endDate, ownerId, origin } = req.query;

    const isAdmin = (req.user && req.user.role && typeof req.user.role === 'string' && req.user.role.toLowerCase() === 'admin');

    let finalOwnerId;
    if (isAdmin) {
      finalOwnerId = ownerId || undefined;
    } else {
      finalOwnerId = req.user?.id;
    }

    const filters = {
      startDate,
      endDate,
      ownerId: finalOwnerId,
      isAdmin,
      origin
    };

    // Busca leads filtrados
    const leads = await getFilteredLeadsWithSeller(filters);

    if (!leads || leads.length === 0) {
      console.log('[ReportController] No leads found for given filters -> returning 204');
      return res.status(204).send();
    }

    const totalLeads = leads.length;
    const wonLeads = leads.filter(l => String(l.status).toLowerCase() === 'ganho' || String(l.status).toLowerCase() === 'ganhado' || String(l.status).toLowerCase() === 'won');
    const lostLeads = leads.filter(l => String(l.status).toLowerCase() === 'perdido' || String(l.status).toLowerCase() === 'lost');
    const activeLeads = leads.filter(l => !['ganho', 'perdido', 'won', 'lost'].includes(String(l.status).toLowerCase()));

    const totalValueInNegotiation = leads
      .filter(l => ['Em Negociação', 'Proposta Enviada', 'em negociação', 'proposta enviada'].includes(String(l.status)))
      .reduce((sum, l) => sum + (Number(l.estimated_savings) || 0), 0);

    const avgResponseTime = 32; // placeholder

    // Funnel
    const funnelDataObj = leads.reduce((acc, l) => {
      const st = l.status || 'Desconhecido';
      acc[st] = (acc[st] || 0) + 1;
      return acc;
    }, {});
    const funnelData = Object.keys(funnelDataObj).map(status => ({ status, count: funnelDataObj[status] }));

    // Performance por vendedor
    const performanceDataObj = leads.reduce((acc, l) => {
      const ownerIdKey = l.owner_id || 'unknown';
      if (!acc[ownerIdKey]) {
        acc[ownerIdKey] = { name: l.owner_name || 'Sem nome', totalLeads: 0, wonLeads: 0, activeLeads: 0, totalTimeToClose: 0, wonCount: 0 };
      }
      acc[ownerIdKey].totalLeads++;
      if (String(l.status).toLowerCase() === 'ganho' || String(l.status).toLowerCase() === 'won') {
        acc[ownerIdKey].wonLeads++;
        acc[ownerIdKey].wonCount++;
        acc[ownerIdKey].totalTimeToClose += Number(l.time_to_close_days) || 0;
      }
      if (!['ganho', 'perdido', 'won', 'lost'].includes(String(l.status).toLowerCase())) {
        acc[ownerIdKey].activeLeads++;
      }
      return acc;
    }, {});
    const sellerPerformance = Object.values(performanceDataObj).map(p => ({
      name: p.name,
      totalLeads: p.totalLeads,
      wonLeads: p.wonLeads,
      activeLeads: p.activeLeads,
      conversionRate: (p.totalLeads > 0 ? ((p.wonLeads / p.totalLeads) * 100).toFixed(1) : 0) + '%',
      avgTimeToClose: p.wonCount > 0 ? Math.round(p.totalTimeToClose / p.wonCount) : 0
    }));

    // Origem
    const originAnalysisObj = leads.reduce((acc, l) => {
      const originKey = l.origin || 'Desconhecida';
      if (!acc[originKey]) acc[originKey] = { origin: originKey, totalLeads: 0, wonLeads: 0 };
      acc[originKey].totalLeads++;
      if (String(l.status).toLowerCase() === 'ganho' || String(l.status).toLowerCase() === 'won') {
        acc[originKey].wonLeads++;
      }
      return acc;
    }, {});
    const originAnalysis = Object.values(originAnalysisObj);

    // Razões de perda
    const lossReasonsObj = lostLeads.reduce((acc, l) => {
      if (l.reason_for_loss) {
        acc[l.reason_for_loss] = (acc[l.reason_for_loss] || 0) + 1;
      }
      return acc;
    }, {});
    const lossReasons = Object.keys(lossReasonsObj).map(reason => ({ reason, count: lossReasonsObj[reason] }));

    const dashboard = {
      newLeads: totalLeads,
      activeLeads: activeLeads.length,
      conversionRate: (totalLeads > 0 ? ((wonLeads.length / totalLeads) * 100).toFixed(1) : 0) + '%',
      avgResponseTime,
      totalValueInNegotiation,
      funnelData,
      sellerPerformance,
      originAnalysis,
      lossReasons
    };

    console.log(`[ReportController] getDashboardData returning dashboard with ${totalLeads} leads`);
    return res.json(dashboard);

  } catch (error) {
    console.error('Erro CRÍTICO ao buscar dados do dashboard (getDashboardData):', error);
    return res.status(500).json({ error: 'Erro interno do servidor ao processar o dashboard.' });
  }
};

// =============================================================
// ENDPOINT DE EXPORTAÇÃO (CSV / PDF)
// =============================================================
exports.exportReports = async (req, res) => {
  try {
    console.log(`[ReportController] exportReports called user=${req.user?.id || 'anon'} query=${JSON.stringify(req.query)}`);

    const { format: exportFormat, startDate, endDate, ownerId, origin } = req.query;

    const isAdmin = (req.user && req.user.role && typeof req.user.role === 'string' && req.user.role.toLowerCase() === 'admin');

    let finalOwnerId;
    if (isAdmin) {
      finalOwnerId = ownerId || undefined;
    } else {
      finalOwnerId = req.user?.id;
    }

    const filters = { startDate, endDate, ownerId: finalOwnerId, isAdmin, origin };

    // Reuse query logic (could be refactored) — vamos replicar de forma simples
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

    if (filters.ownerId) {
      query += ` AND l.owner_id = $${valueIndex}`;
      values.push(filters.ownerId);
      valueIndex++;
    }
    if (filters.startDate) {
      const sd = new Date(filters.startDate);
      sd.setHours(0, 0, 0, 0);
      query += ` AND l.created_at >= $${valueIndex}`;
      values.push(sd);
      valueIndex++;
    }
    if (filters.endDate) {
      const ed = new Date(filters.endDate);
      ed.setHours(23, 59, 59, 999);
      query += ` AND l.created_at <= $${valueIndex}`;
      values.push(ed);
      valueIndex++;
    }
    if (filters.origin) {
      query += ` AND l.origin = $${valueIndex}`;
      values.push(filters.origin);
      valueIndex++;
    }
    query += ` ORDER BY l.created_at DESC`;

    const result = await pool.query(query, values);
    const leads = result.rows || [];

    if (!leads || leads.length === 0) {
      console.log('[ReportController] exportReports -> no leads found, returning 204');
      return res.status(204).send();
    }

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
