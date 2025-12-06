// services/ReportDataService.js
const pool = require('../db');
const { format, subDays } = require('date-fns');

/* -----------------------------------------------------
   buildFilter(filters, userId, isAdmin)
   - considera created_at OU updated_at no período
   - owner_id (admin/usuário)
   - origin/source
----------------------------------------------------- */
function buildFilter(filters = {}, userId = null, isAdmin = false) {
  const { startDate, endDate, ownerId, source } = filters || {};

  const today = new Date();
  const defaultEnd = format(today, 'yyyy-MM-dd');
  const defaultStart = format(subDays(today, 29), 'yyyy-MM-dd');

  const start = startDate || defaultStart;
  const end = endDate || defaultEnd;

  const startTs = `${start} 00:00:00`;
  const endTs = `${end} 23:59:59`;

  const values = [startTs, endTs];
  let idx = 3;

  const where = `
    WHERE (
      (created_at >= $1 AND created_at <= $2)
      OR
      (updated_at >= $1 AND updated_at <= $2)
    )
  `;

  let extendedWhere = where;

  if (!isAdmin && userId) {
    extendedWhere += ` AND owner_id = $${idx++}`;
    values.push(userId);
  }

  if (isAdmin && ownerId && ownerId !== 'all') {
    extendedWhere += ` AND owner_id = $${idx++}`;
    values.push(ownerId);
  }

  if (source && source !== 'all') {
    extendedWhere += ` AND origin = $${idx++}`;
    values.push(source);
  }

  return { whereClause: extendedWhere, values };
}

/* -----------------------------------------------------
   getAllDashboardData
----------------------------------------------------- */
async function getAllDashboardData(filters = {}, userId = null, isAdmin = false) {
  try {
    const [
      summary, stageFunnel, originFunnelResult,
      lostReasons, dailyActivity, mapLocations
    ] = await Promise.all([
      getSummaryAndProductivity(filters, userId, isAdmin),
      getStageFunnel(filters, userId, isAdmin),
      getOriginFunnel(filters, userId, isAdmin),
      getLostReasonsData(filters, userId, isAdmin),
      getDailyActivity(filters, userId, isAdmin),
      getMapLocations(filters, userId, isAdmin)
    ]);

    return {
      globalSummary: summary,
      productivity: { ...summary },
      funnel: stageFunnel || [],
      originStats: originFunnelResult.obj || {},
      funnelOrigins: originFunnelResult.arr || [],
      lostReasons,
      dailyActivity,
      mapLocations,
      forecasting: { forecastedKwWeighted: 0 }
    };
  } catch (err) {
    console.error('ERRO CRÍTICO EM getAllDashboardData:', err);
    throw err;
  }
}

/* -----------------------------------------------------
   getStageFunnel
   - retorna contagem por status (inclui Inapto)
----------------------------------------------------- */
async function getStageFunnel(filters, userId, isAdmin) {
  const { whereClause, values } = buildFilter(filters, userId, isAdmin);
  const q = `
    SELECT status AS stage_name, COUNT(*)::int AS count
    FROM leads
    ${whereClause}
    GROUP BY status
    ORDER BY count DESC
  `;
  const r = await pool.query(q, values);
  return r.rows.map(rw => ({
    stage: rw.stage_name,
    _count: { id: Number(rw.count || 0) }
  }));
}

/* -----------------------------------------------------
   getOriginFunnel
----------------------------------------------------- */
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

/* -----------------------------------------------------
   getLostReasonsData
----------------------------------------------------- */
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
  const totalLost = result.rows.reduce((s, r) => s + Number(r.count), 0);

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

/* -----------------------------------------------------
   getDailyActivity
----------------------------------------------------- */
async function getDailyActivity(filters, userId, isAdmin) {
  const { whereClause, values } = buildFilter(filters, userId, isAdmin);
  const q = `
    SELECT created_at::date AS activity_date, COUNT(*)::int AS leads_created
    FROM leads
    ${whereClause}
    GROUP BY created_at::date
    ORDER BY activity_date ASC
  `;
  const r = await pool.query(q, values);
  return r.rows.map(row => ({ date: row.activity_date, count: Number(row.leads_created || 0) }));
}

/* -----------------------------------------------------
   getMapLocations
----------------------------------------------------- */
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
  return r.rows.map(row => ({ city: row.city, count: Number(row.count || 0), lat: row.lat ? Number(row.lat) : null, lng: row.lng ? Number(row.lng) : null }));
}

/* -----------------------------------------------------
   getLeadsForExport
----------------------------------------------------- */
async function getLeadsForExport(filters, userId, isAdmin) {
  const { whereClause, values } = buildFilter(filters, userId, isAdmin);
  const q = `
    SELECT l.*, u.name AS owner_name
    FROM leads l
    LEFT JOIN users u ON u.id = l.owner_id
    ${whereClause}
    ORDER BY l.created_at DESC
  `;
  const r = await pool.query(q, values);
  return r.rows;
}

/* -----------------------------------------------------
   getSummaryAndProductivity
   - regras pedidas pelo usuário aplicadas aqui
----------------------------------------------------- */
async function getSummaryAndProductivity(filters = {}, userId = null, isAdmin = false) {
  // garantir datas válidas
  const startDate = filters.startDate || format(subDays(new Date(), 29), 'yyyy-MM-dd');
  const endDate = filters.endDate || format(new Date(), 'yyyy-MM-dd');

  const { whereClause, values } = buildFilter({ startDate, endDate, ...filters }, userId, isAdmin);

  // 1) métricas diretas
  const mainQuery = `
    SELECT
      COUNT(*) AS total_leads,
      SUM(CASE WHEN LOWER(status) = 'ganho' THEN 1 ELSE 0 END) AS total_won_count,
      SUM(CASE WHEN LOWER(status) = 'perdido' THEN 1 ELSE 0 END) AS total_lost_count,
      SUM(CASE WHEN LOWER(status) = 'inapto' THEN 1 ELSE 0 END) AS total_inapto_count,
      SUM(
        CASE WHEN LOWER(status) = 'ganho' AND avg_consumption IS NOT NULL
             AND TRIM(avg_consumption::text) <> ''
             THEN NULLIF(TRIM(avg_consumption::text), '')::numeric
             ELSE 0 END
      ) AS total_won_value_kw
    FROM leads
    ${whereClause}
  `;

  // 2) buscar leads para cálculos em JS
  const leadsQuery = `
    SELECT id, status, created_at, updated_at, notes
    FROM leads
    ${whereClause}
  `;

  const [mainR, leadsR] = await Promise.all([
    pool.query(mainQuery, values),
    pool.query(leadsQuery, values)
  ]);

  const row = mainR.rows[0] || {};
  const leads = leadsR.rows || [];

  // classificação
  const ganhos = leads.filter(l => (l.status || '').toLowerCase() === 'ganho');
  const perdidos = leads.filter(l => (l.status || '').toLowerCase() === 'perdido');
  const inaptos = leads.filter(l => (l.status || '').toLowerCase() === 'inapto');
  const ativos = leads.filter(l => !['ganho', 'perdido', 'inapto'].includes((l.status || '').toLowerCase()));

  // tempo médio (horas)
  const calcHours = arr => {
    const diffs = arr
      .map(l => {
        if (!l.created_at || !l.updated_at) return null;
        const diff = new Date(l.updated_at) - new Date(l.created_at);
        return diff > 0 ? diff : null;
      })
      .filter(v => v !== null);
    if (!diffs.length) return 0;
    return Number((diffs.reduce((a, b) => a + b, 0) / diffs.length / 3600000).toFixed(2));
  };
  const tempoMedioFechamentoHoras = calcHours(ganhos);
  const tempoMedioAtendimentoHoras = calcHours(ativos);

  // contabilizar notas no período
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T23:59:59');

  let atendimentosRealizados = 0;
  for (const lead of leads) {
    if (!lead.notes) continue;
    let arr = [];
    try { arr = JSON.parse(lead.notes); } catch (e) { continue; }
    for (const n of arr) {
      if (!n || !n.timestamp) continue;
      const dt = new Date(Number(n.timestamp));
      if (dt >= start && dt <= end) atendimentosRealizados++;
    }
  }

  // totais e percentuais
  const totalLeads = Number(row.total_leads || 0);
  const totalWon = Number(row.total_won_count || 0);
  const totalLost = Number(row.total_lost_count || 0);
  const totalInapto = Number(row.total_inapto_count || 0);
  const totalWonValueKW = Number(row.total_won_value_kw || 0);

  // denominador para conversão/perda: EXCLUÍMOS INAPTOS
  const denomForConversion = Math.max(totalLeads - totalInapto, 0);

  const conversionRate = denomForConversion > 0 ? Number(((totalWon / denomForConversion) * 100).toFixed(2)) : 0;
  const lossRate = denomForConversion > 0 ? Number(((totalLost / denomForConversion) * 100).toFixed(2)) : 0;
  const taxaInapto = totalLeads > 0 ? Number(((totalInapto / totalLeads) * 100).toFixed(2)) : 0;

  return {
    totalLeads,
    totalWonCount: totalWon,
    totalLostCount: totalLost,
    totalInaptoCount: totalInapto,
    totalWonValueKW,

    // nomes compatíveis com front
    ativosCount: ativos.length,
    leadsActive: ativos.length,

    atendimentosRealizados,
    tempoMedioFechamentoHoras,
    tempoMedioAtendimentoHoras,

    conversionRate,   // % considerando INAPTOS excluídos do denominador
    lossRate,         // % considerando INAPTOS excluídos do denominador
    taxaInapto        // % do totalLeads
  };
}

/* -----------------------------------------------------
   getMotivosPerdaReport
----------------------------------------------------- */
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
  const r = await pool.query(q, values);
  return r.rows.map(r => ({ reason: r.reason, count: Number(r.count || 0) }));
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
  getAllDashboardData,
  getMotivosPerdaReport
};
