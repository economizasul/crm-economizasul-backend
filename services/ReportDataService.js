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
 * getSummaryAndProductivity
 * (mantive sua lógica original — apenas certifique-se que a query funcione com seu schema)
 */
async function getSummaryAndProductivity(filters, userId, isAdmin) {
  const { whereClause, values } = buildFilter(filters, userId, isAdmin);
  const query = `
    SELECT
      COALESCE(COUNT(*), 0) AS total_leads,

      -- ✔ LEADS GANHOS (status = 'Ganho')
      COALESCE(SUM(CASE WHEN LOWER(status) = 'ganho' THEN 1 ELSE 0 END), 0) AS total_won_count,

      -- ✔ KW vendido (usa avg_consumption direto pois é numérico)
      COALESCE(SUM(CASE WHEN LOWER(status) = 'ganho' THEN avg_consumption ELSE 0 END), 0) AS total_won_value_kw,

      -- ✔ PERDIDOS
      COALESCE(SUM(CASE WHEN LOWER(status) = 'perdido' THEN 1 ELSE 0 END), 0) AS total_lost_count,

      -- ✔ Taxa de conversão
      COALESCE(
        (SUM(CASE WHEN LOWER(status) = 'ganho' THEN 1 ELSE 0 END)::numeric * 100) / NULLIF(COUNT(*), 0),
        0
      ) AS conversion_rate_percent,

      -- ✔ Tempo médio de conversão: usa date_won
      COALESCE(
        AVG(
          CASE 
            WHEN LOWER(status) = 'ganho' AND date_won IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (date_won - created_at)) / 86400
            ELSE NULL
          END
        ),
        0
      ) AS avg_closing_time_days
    FROM leads
    ${whereClause}
  `;

  try {
    const result = await pool.query(query, values);
    const row = result.rows[0] || {};
    const leadQuery = `
      SELECT id, status, created_at, updated_at
      FROM leads
      ${whereClause}
    `;

    const leadRes = await pool.query(leadQuery, values);
    const leads = leadRes.rows || [];
    const ganhos = leads.filter(l => String(l.status || '').toLowerCase() === 'ganho');

    let tempoMedioFechamentoHoras = 0;

    if (ganhos.length > 0) {
      tempoMedioFechamentoHoras =
        ganhos.reduce((acc, l) => {
          const criacao = new Date(l.created_at);
          const fechamento = new Date(l.updated_at);
          return acc + (fechamento - criacao) / (1000 * 60 * 60);
        }, 0) / ganhos.length;
    }

    const ativos = leads.filter(
      l => {
        const s = String(l.status || '').toLowerCase();
        return s !== 'ganho' && s !== 'perdido';
      }
    );

    let tempoMedioAtendimentoHoras = 0;

    if (ativos.length > 0) {
      tempoMedioAtendimentoHoras =
        ativos.reduce((acc, l) => {
          const criacao = new Date(l.created_at);
          const atualizacao = new Date(l.updated_at);
          return acc + (atualizacao - criacao) / (1000 * 60 * 60);
        }, 0) / ativos.length;
    }

    return {
      totalLeads: Number(row.total_leads || 0),
      totalWonCount: Number(row.total_won_count || 0),
      totalWonValueKW: Number(row.total_won_value_kw || 0),
      totalLostCount: Number(row.total_lost_count || 0),
      conversionRate: Number(row.conversion_rate_percent || 0) / 100,
      avgClosingTimeDays: Number(row.avg_closing_time_days || 0),

      tempoMedioFechamentoHoras,
      tempoMedioAtendimentoHoras
    };

  } catch (err) {
    console.error('SQL ERROR getSummaryAndProductivity:', err.message);
    console.error('Query:', query);
    console.error('Values:', values);
    throw err;
  }
}

/**
 * getStageFunnel — funnel por STATUS (Contatos, Conversando, Ganho, Inapto, etc.)
 */
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

  try {
    const r = await pool.query(q, values);
    return r.rows.map(rw => ({
      stage: rw.stage_name,
       _count: { id: Number(rw.count || 0) }
    }));

  } catch (err) {
    console.error('SQL ERROR getStageFunnel:', err.message);
    throw err;
  }
}

/**
 * getOriginFunnel — funnel por ORIGIN (Orgânico, Indicação, Facebook, ...)
 * Retorna tanto array quanto objeto (originStats) para facilitar o frontend.
 */
async function getOriginFunnel(filters, userId, isAdmin) {
  const { whereClause, values } = buildFilter(filters, userId, isAdmin);

  const q = `
    SELECT 
      COALESCE(NULLIF(TRIM(origin), ''), 'Não informado') AS origin_name, 
      COUNT(*)::int AS count
    FROM leads
    ${whereClause}
    GROUP BY origin_name
    ORDER BY count DESC
  `;

  try {
    const r = await pool.query(q, values);
    const arr = r.rows.map(rw => ({ origin: rw.origin_name, count: Number(rw.count || 0) }));
    const obj = {};
    arr.forEach(it => { obj[it.origin] = it.count; });
    return { arr, obj };
  } catch (err) {
    console.error('SQL ERROR getOriginFunnel:', err.message);
    throw err;
  }
}

/**
 * getLostReasonsData
 */
async function getLostReasonsData(filters, userId, isAdmin) {
  const { whereClause, values } = buildFilter(filters, userId, isAdmin);

  const totalLostQuery = `
    SELECT COALESCE(COUNT(*),0) AS total_lost
    FROM leads
    ${whereClause} AND LOWER(status) = 'perdido'
  `;
  const reasonsQuery = `
    SELECT reason_for_loss AS reason, COUNT(*)::int AS count
    FROM leads
    ${whereClause}
    AND LOWER(status) = 'perdido' AND reason_for_loss IS NOT NULL
    GROUP BY reason_for_loss
    ORDER BY count DESC
  `;

  try {
    const [totalLostRes, reasonsRes] = await Promise.all([
      pool.query(totalLostQuery, values),
      pool.query(reasonsQuery, values)
    ]);

    const totalLost = Number(totalLostRes.rows[0]?.total_lost || 0);
    const reasons = reasonsRes.rows.map(r => ({ reason: r.reason, count: Number(r.count || 0) }));
    return { reasons, totalLost };
  } catch (err) {
    console.error('SQL ERROR getLostReasonsData:', err.message);
    throw err;
  }
}

/**
 * getDailyActivity
 */
async function getDailyActivity(filters, userId, isAdmin) {
  const { whereClause, values } = buildFilter(filters, userId, isAdmin);

  const q = `
    SELECT created_at::date AS activity_date, COUNT(*)::int AS leads_created
    FROM leads
    ${whereClause}
    GROUP BY created_at::date
    ORDER BY activity_date ASC
  `;
  try {
    const r = await pool.query(q, values);
    return r.rows.map(row => ({
      date: row.activity_date,
      count: Number(row.leads_created || 0)
    }));
  } catch (err) {
    console.error('SQL ERROR getDailyActivity:', err.message);
    throw err;
  }
}

/**
 * getMapLocations
 */
async function getMapLocations(filters, userId, isAdmin) {
  const { whereClause, values } = buildFilter(filters, userId, isAdmin);

  const q = `
    SELECT 
      city,
      COUNT(*)::int AS count,
      AVG(lat)::numeric AS lat,
      AVG(lng)::numeric AS lng
    FROM (
      SELECT
        COALESCE(
          NULLIF(TRIM((metadata->>'city')::text), ''),
          NULLIF(TRIM(split_part(address, ',', 1)), '')
        ) AS city,
        lat,
        lng
      FROM leads
      ${whereClause} AND LOWER(status) = 'ganho'
    ) AS sub
    WHERE city IS NOT NULL AND city <> ''
    GROUP BY city
    ORDER BY count DESC
    LIMIT 200
  `;

  try {
    const r = await pool.query(q, values);

    return r.rows.map(row => ({
      city: row.city,
      count: Number(row.count || 0),
      lat: row.lat ? Number(row.lat) : null,
      lng: row.lng ? Number(row.lng) : null
    }));
  } catch (err) {
    console.error('SQL ERROR getMapLocations:', err.message);
    throw err;
  }
}

/**
 * getLeadsForExport
 */
async function getLeadsForExport(filters, userId, isAdmin) {
  const { whereClause, values } = buildFilter(filters, userId, isAdmin);

  const q = `
    SELECT l.*, u.name AS owner_name
    FROM leads l
    LEFT JOIN users u ON u.id = l.owner_id
    ${whereClause}
    ORDER BY l.created_at DESC
  `;
  try {
    const r = await pool.query(q, values);
    return r.rows;
  } catch (err) {
    console.error('SQL ERROR getLeadsForExport:', err.message);
    throw err;
  }
}

/**
 * getAllDashboardData
 */
async function getAllDashboardData(filters = {}, userId = null, isAdmin = false) {
  try {
    const { whereClause, values } = buildFilter(filters, userId, isAdmin);

    // chamamos explicitamente as funções que precisam de filtros (passando filters para as que precisam)
    const [
      summary,
      stageFunnel,
      originFunnelResult,
      lostReasons,
      dailyActivity,
      mapLocations
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
      // funnel (por estágio/status) para onde o frontend já o utiliza (ex: procura 'Inapto')
      funnel: stageFunnel || [],
      // originStats: objeto { origem: quantidade }
      originStats: originFunnelResult.obj || {},
      // funnelOrigins: array [{ origin, count }] (opcional — dá flexibilidade)
      funnelOrigins: originFunnelResult.arr || [],
      lostReasons,
      dailyActivity,
      mapLocations,
      forecasting: { forecastedKwWeighted: 0 }
    };
  } catch (err) {
    console.error('CRITICAL ERROR getAllDashboardData:', err);
    throw err;
  }
}

/**
 * getMotivosPerdaReport — relatório exclusivo para o gráfico
 */
async function getMotivosPerdaReport(filters = {}, userId = null, isAdmin = false) {
  const { whereClause, values } = buildFilter(filters, userId, isAdmin);

  const q = `
    SELECT 
      COALESCE(NULLIF(TRIM(reason_for_loss), ''), 'Não informado') AS reason,
      COUNT(*)::int AS count
    FROM leads
    ${whereClause}
    AND LOWER(status) = 'perdido'
    GROUP BY reason
    ORDER BY count DESC
  `;

  try {
    const result = await pool.query(q, values);

    return result.rows.map(r => ({
      reason: r.reason,
      count: Number(r.count || 0)
    }));

  } catch (err) {
    console.error("SQL ERROR getMotivosPerdaReport:", err.message);
    throw err;
  }
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
