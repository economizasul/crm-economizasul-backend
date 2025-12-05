// services/ReportDataService.js
const pool = require('../db');
const { format, subDays } = require('date-fns');

/**
 * buildFilter(filters, userId, isAdmin)
 */
function buildFilter(filters = {}, userId = null, isAdmin = false) {
  const { startDate, endDate, ownerId, source } = filters || {};

  const today = new Date();
  const defaultEnd = format(today, 'yyyy-MM-dd');
  const defaultStart = format(subDays(today, 29), 'yyyy-MM-dd');

  const start = startDate || defaultStart;
  const end = endDate || defaultEnd;

  const startTs = `${start} 00:00:00`;
  const endTs = `${end} 23:59:59`;

  let where = `WHERE created_at >= $1 AND created_at <= $2`;
  const values = [startTs, endTs];
  let idx = 3;

  if (!isAdmin) {
    if (userId) {
      where += ` AND owner_id = $${idx++}`;
      values.push(userId);
    }
  } else if (ownerId && ownerId !== 'all') {
    where += ` AND owner_id = $${idx++}`;
    values.push(ownerId);
  }

  if (source && source !== 'all') {
    where += ` AND origin = $${idx++}`;
    values.push(source);
  }

  return { whereClause: where, values };
}

/**
 * getSummaryAndProductivity - VERSÃO 100% CORRIGIDA
 */
async function getSummaryAndProductivity(filters, userId, isAdmin) {
  const { whereClause, values } = buildFilter(filters, userId, isAdmin);

  const query = `
    SELECT
      COALESCE(COUNT(*), 0) AS total_leads,
      COALESCE(SUM(CASE WHEN LOWER(status) = 'ganho' THEN 1 ELSE 0 END), 0) AS total_won_count,
      COALESCE(SUM(CASE WHEN LOWER(status) = 'ganho' AND avg_consumption IS NOT NULL THEN NULLIF(TRIM(avg_consumption::text), '')::numeric ELSE 0 END), 0) AS total_won_value_kw,
      COALESCE(SUM(CASE WHEN LOWER(status) = 'perdido' THEN 1 ELSE 0 END), 0) AS total_lost_count,
      COALESCE(SUM(CASE WHEN LOWER(status) = 'inapto' THEN 1 ELSE 0 END), 0) AS total_inapto_count,
      COALESCE(SUM(CASE WHEN notes IS NOT NULL AND TRIM(notes) <> '' THEN 1 ELSE 0 END), 0) AS atendimentos_realizados,
      COALESCE((SUM(CASE WHEN LOWER(status) = 'ganho' THEN 1 ELSE 0 END)::numeric * 100) / NULLIF(COUNT(*), 0), 0) AS conversion_rate_percent,
      COALESCE((SUM(CASE WHEN LOWER(status) = 'inapto' THEN 1 ELSE 0 END)::numeric * 100) / NULLIF(COUNT(*), 0), 0) AS taxa_inapto_percent
    FROM leads
    ${whereClause}
  `;

  try {
    const [mainResult, leadsResult] = await Promise.all([
      pool.query(query, values),
      pool.query(`SELECT status, created_at, updated_at FROM leads ${whereClause}`, values)
    ]);

    const row = mainResult.rows[0] || {};
    const leads = leadsResult.rows || [];

    const calculateAvgHours = (list) => {
      if (!list || list.length === 0) return 0;
      const valid = list
        .filter(l => l.created_at && l.updated_at)
        .map(l => {
          const diff = new Date(l.updated_at) - new Date(l.created_at);
          return diff > 0 ? diff / (3600000) : null;
        })
        .filter(h => h !== null);
      return valid.length > 0 ? Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2)) : 0;
    };

    const ganhos = leads.filter(l => (l.status || '').toLowerCase() === 'ganho');
    const ativos = leads.filter(l => {
      const s = (l.status || '').toLowerCase();
      return s !== 'ganho' && s !== 'perdido' && s !== 'inapto';
    });

    const tempoMedioFechamentoHoras = calculateAvgHours(ganhos);
    const tempoMedioAtendimentoHoras = calculateAvgHours(ativos);

    return {
      totalLeads: Number(row.total_leads || 0),
      totalWonCount: Number(row.total_won_count || 0),
      totalWonValueKW: Number(row.total_won_value_kw || 0),
      totalLostCount: Number(row.total_lost_count || 0),
      totalInaptoCount: Number(row.total_inapto_count || 0),
      taxaInapto: Number(row.taxa_inapto_percent || 0),
      atendimentosRealizados: Number(row.atendimentos_realizados || 0),
      conversionRate: Number(row.conversion_rate_percent || 0),
      tempoMedioFechamentoHoras,
      tempoMedioAtendimentoHoras
    };

  } catch (err) {
    console.error('ERRO EM getSummaryAndProductivity:', err);
    throw err;
  }
}

// === AS DEMAIS FUNÇÕES ESTÃO PERFEITAS (mantidas intactas) ===
async function getStageFunnel(filters, userId, isAdmin) {
  const { whereClause, values } = buildFilter(filters, userId, isAdmin);
  const q = `
    SELECT status AS stage_name, COUNT(*)::int AS count
    FROM leads
    ${whereClause}
    AND LOWER(status) <> 'inapto'
    GROUP BY status
    ORDER BY count DESC
  `;
  const r = await pool.query(q, values);
  return r.rows.map(rw => ({
    stage: rw.stage_name,
    _count: { id: Number(rw.count || 0) }
  }));
}

async function getOriginFunnel(filters, userId, isAdmin) {
  const { whereClause, values } = buildFilter(filters, userId, isAdmin);
  const q = `
    SELECT COALESCE(NULLIF(TRIM(origin), ''), 'Não informado') AS origin_name, 
           COUNT(*)::int AS count
    FROM leads
    ${whereClause}
    GROUP BY origin_name
    ORDER BY count DESC
  `;
  const r = await pool.query(q, values);
  const arr = r.rows.map(rw => ({ origin: rw.origin_name, count: Number(rw.count || 0) }));
  const obj = {};
  arr.forEach(it => { obj[it.origin] = it.count; });
  return { arr, obj };
}

async function getLostReasonsData(filters, userId, isAdmin) {
  const { whereClause, values } = buildFilter(filters, userId, isAdmin);
  const query = `
    SELECT COALESCE(NULLIF(TRIM(reason_for_loss), ''), 'Não informado') AS reason_raw,
           COUNT(*)::int AS count
    FROM leads
    ${whereClause}
    AND LOWER(status) = 'perdido'
    GROUP BY reason_raw
    ORDER BY count DESC
  `;
  const result = await pool.query(query, values);
  const totalLost = result.rows.reduce((sum, r) => sum + Number(r.count), 0);

  const mapaMotivos = {
    'oferta_melhor': 'Oferta Melhor..:', 'incerteza': 'Incerteza..:', 'geracao_propria': 'Geração Própria..:',
    'burocracia': 'Burocracia..:', 'contrato': 'Contrato..:', 'restricoes_tecnicas': 'Restrições Técnicas..:',
    'nao_responsavel': 'Não é o Responsável..:', 'silencio': 'Silêncio..:', 'ja_possui_gd': 'Já Possui GD..:',
    'outro_estado': 'Outro Estado..:', 'outro': 'Outro..:', 'não informado': 'Outro..:'
  };

  const reasons = result.rows.map(r => {
    const chave = (r.reason_raw || 'outro').toLowerCase().replace(/\s+/g, '_');
    const motivoFormatado = mapaMotivos[chave] || 'Outro..:';
    return {
      reason: motivoFormatado,
      count: Number(r.count),
      percentage: totalLost > 0 ? Number((r.count / totalLost * 100).toFixed(1)) : 0
    };
  });

  return { reasons: reasons.sort((a, b) => b.count - a.count), totalLost };
}

async function getDailyActivity(filters, userId, isAdmin) {
  const { whereClause, values } = buildFilter(filters, userId, isAdmin);
  const q = `SELECT created_at::date AS activity_date, COUNT(*)::int AS leads_created FROM leads ${whereClause} GROUP BY created_at::date ORDER BY activity_date ASC`;
  const r = await pool.query(q, values);
  return r.rows.map(row => ({ date: row.activity_date, count: Number(row.leads_created || 0) }));
}

async function getMapLocations(filters, userId, isAdmin) {
  const { whereClause, values } = buildFilter(filters, userId, isAdmin);
  const q = `
    SELECT city, COUNT(*)::int AS count, AVG(lat)::numeric AS lat, AVG(lng)::numeric AS lng
    FROM (
      SELECT COALESCE(NULLIF(TRIM((metadata->>'city')::text), ''), NULLIF(TRIM(split_part(address, ',', 1)), '')) AS city,
             lat, lng
      FROM leads
      ${whereClause} AND LOWER(status) = 'ganho'
    ) AS sub
    WHERE city IS NOT NULL AND city <> ''
    GROUP BY city
    ORDER BY count DESC
    LIMIT 200
  `;
  const r = await pool.query(q, values);
  return r.rows.map(row => ({
    city: row.city,
    count: Number(row.count || 0),
    lat: row.lat ? Number(row.lat) : null,
    lng: row.lng ? Number(row.lng) : null
  }));
}

async function getLeadsForExport(filters, userId, isAdmin) {
  const { whereClause, values } = buildFilter(filters, userId, isAdmin);
  const q = `SELECT l.*, u.name AS owner_name FROM leads l LEFT JOIN users u ON u.id = l.owner_id ${whereClause} ORDER BY l.created_at DESC`;
  const r = await pool.query(q, values);
  return r.rows;
}

/**
 * getSummaryAndProductivity - VERSÃO CORRIGIDA E FINAL (05/12/2025)
 */
async function getSummaryAndProductivity(filters, userId, isAdmin) {
  const { whereClause, values } = buildFilter(filters, userId, isAdmin);

  // 1. PRIMEIRA QUERY: métricas básicas + total de leads no período
  const baseQuery = `
    SELECT
      COUNT(*) AS total_leads,
      SUM(CASE WHEN LOWER(status) = 'ganho' THEN 1 ELSE 0 END) AS total_won_count,
      SUM(CASE WHEN LOWER(status) = 'ganho' AND avg_consumption IS NOT NULL THEN NULLIF(TRIM(avg_consumption::text), '')::numeric ELSE 0 END) AS total_won_value_kw,
      SUM(CASE WHEN LOWER(status) = 'perdido' THEN 1 ELSE 0 END) AS total_lost_count,
      SUM(CASE WHEN LOWER(status) = 'inapto' THEN 1 ELSE 0 END) AS total_inapto_count_period
    FROM leads
    ${whereClause}
  `;

  // 2. SEGUNDA QUERY: contar NOTAS criadas dentro do período (usando JSONB)
  const notesQuery = `
    SELECT COUNT(*) AS notes_in_period
    FROM leads,
         jsonb_array_elements(
           CASE 
             WHEN jsonb_typeof(notes) = 'array' THEN notes 
             WHEN notes IS NULL OR notes = '[]'::jsonb THEN '[]'::jsonb
             ELSE '[]'::jsonb 
           END
         ) AS note_elem
    WHERE ${whereClause.replace('WHERE', '')}  -- remove o WHERE pra não duplicar
      AND note_elem->>'timestamp' IS NOT NULL
    AND TO_TIMESTAMP((note_elem->>'timestamp')::bigint / 1000) BETWEEN $1 AND $2
  `;

  try {
    const [baseResult, notesResult, leadsResult] = await Promise.all([
      pool.query(baseQuery, values),
      pool.query(notesQuery, values), // usa os mesmos valores (start e end já estão em values[0] e values[1])
      pool.query(`SELECT status, created_at, updated_at FROM leads ${whereClause}`, values)
    ]);

    const row = baseResult.rows[0] || {};
    const leads = leadsResult.rows || [];

    // Contagem correta de notas no período
    const totalNotesInPeriod = Number(notesResult.rows[0]?.notes_in_period || 0);

    // Taxa de inaptos correta (só do período)
    const totalLeadsPeriod = Number(row.total_leads || 0);
    const inaptosNoPeriodo = Number(row.total_inapto_count_period || 0);
    const taxaInaptoPercent = totalLeadsPeriod > 0 
      ? Number(((inaptosNoPeriodo / totalLeadsPeriod) * 100).toFixed(2)) 
      : 0;

    // Cálculo dos tempos médios (mantido igual)
    const calculateAvgHours = (list) => {
      if (!list || list.length === 0) return 0;
      const valid = list
        .filter(l => l.created_at && l.updated_at)
        .map(l => {
          const diff = new Date(l.updated_at) - new Date(l.created_at);
          return diff > 0 ? diff / (3600000) : null;
        })
        .filter(h => h !== null);
      return valid.length > 0 ? Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2)) : 0;
    };

    const ganhos = leads.filter(l => (l.status || '').toLowerCase() === 'ganho');
    const ativos = leads.filter(l => {
      const s = (l.status || '').toLowerCase();
      return s !== 'ganho' && s !== 'perdido' && s !== 'inapto';
    });

    const tempoMedioFechamentoHoras = calculateAvgHours(ganhos);
    const tempoMedioAtendimentoHoras = calculateAvgHours(ativos);

    return {
      totalLeads: totalLeadsPeriod,
      totalWonCount: Number(row.total_won_count || 0),
      totalWonValueKW: Number(row.total_won_value_kw || 0),
      totalLostCount: Number(row.total_lost_count || 0),

      // AQUI ESTÃO AS DUAS MÉTRICAS CORRIGIDAS
      totalInaptoCount: inaptosNoPeriodo,           // ← quantidade de inaptos no período
      taxaInapto: taxaInaptoPercent,                // ← % correta do período
      atendimentosRealizados: totalNotesInPeriod,  // ← quantidade real de notas feitas no período

      conversionRate: totalLeadsPeriod > 0 
        ? Number(((row.total_won_count || 0) / totalLeadsPeriod * 100).toFixed(2)) 
        : 0,

      tempoMedioFechamentoHoras,
      tempoMedioAtendimentoHoras
    };

  } catch (err) {
    console.error('ERRO EM getSummaryAndProductivity:', err);
    throw err;
  }
}

async function getMotivosPerdaReport(filters = {}, userId = null, isAdmin = false) {
  const { whereClause, values } = buildFilter(filters, userId, isAdmin);
  const q = `
    SELECT COALESCE(NULLIF(TRIM(reason_for_loss), ''), 'Não informado') AS reason,
           COUNT(*)::int AS count
    FROM leads
    ${whereClause}
    AND LOWER(status) = 'perdido'
    GROUP BY reason
    ORDER BY count DESC
  `;
  const result = await pool.query(q, values);
  return result.rows.map(r => ({ reason: r.reason, count: Number(r.count || 0) }));
}

module.exports = {
  buildFilter,
  getSummaryAndProductivity,
  getStageFunnel,
  getOriginFunnel,
  getLostReasonsData,
  getDailyActivity,
  getLeadsForExport,
  getMapLocations,
  //getAllDashboardData,
  getMotivosPerdaReport
};