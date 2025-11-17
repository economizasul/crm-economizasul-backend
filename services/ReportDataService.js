// services/ReportDataService.js
const pool = require('../db');
const { format, subDays } = require('date-fns');

/**
 * buildFilter(filters, userId, isAdmin)
 * Retorna whereClause e array de values para queries parametrizadas
 */
function buildFilter(filters = {}, userId = null, isAdmin = false) {
  const { startDate, endDate, ownerId, source } = filters || {};

  // Se não houver datas, padrão para últimos 30 dias
  const today = new Date();
  const defaultEnd = format(today, 'yyyy-MM-dd');
  const defaultStart = format(subDays(today, 29), 'yyyy-MM-dd'); // últimos 30 dias

  const start = startDate && String(startDate).trim() ? String(startDate) : defaultStart;
  const end = endDate && String(endDate).trim() ? String(endDate) : defaultEnd;

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
 * getSummaryAndProductivity(whereClause, values)
 */
async function getSummaryAndProductivity(whereClause, values) {
  const query = `
    SELECT
      COALESCE(COUNT(*), 0) AS total_leads,
      COALESCE(SUM(CASE WHEN LOWER(status) = 'fechado ganho' THEN 1 ELSE 0 END), 0) AS total_won_count,
      COALESCE(
        SUM(
          CASE
            WHEN LOWER(status) = 'fechado ganho' THEN
              NULLIF(
                regexp_replace(REPLACE(NULLIF(TRIM(COALESCE(avg_consumption::text, '')), ''), ',', '.'), '[^0-9.]', '', 'g')
                , ''
              )::numeric
            ELSE 0
          END
        ), 0
      ) AS total_won_value_kw,
      COALESCE(SUM(CASE WHEN LOWER(status) = 'fechado perdido' THEN 1 ELSE 0 END), 0) AS total_lost_count,
      COALESCE(
        (SUM(CASE WHEN LOWER(status) = 'fechado ganho' THEN 1 ELSE 0 END)::numeric * 100) / NULLIF(COUNT(*), 0),
        0
      ) AS conversion_rate_percent,
      COALESCE(
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400),
        0
      ) AS avg_closing_time_days
    FROM leads
    ${whereClause}
  `;

  try {
    const result = await pool.query(query, values);
    const row = result.rows[0] || {};

    return {
      totalLeads: parseInt(row.total_leads || 0, 10),
      totalWonCount: parseInt(row.total_won_count || 0, 10),
      totalWonValueKW: parseFloat(row.total_won_value_kw || 0),
      totalLostCount: parseInt(row.total_lost_count || 0, 10),
      conversionRate: parseFloat(row.conversion_rate_percent || 0) / 100,
      avgClosingTimeDays: parseFloat(row.avg_closing_time_days || 0)
    };
  } catch (err) {
    console.error('SQL ERROR getSummaryAndProductivity:', err.message);
    console.error('Query:', query);
    console.error('Values:', values);
    throw err;
  }
}

/**
 * getFunnelData(filters, userId, isAdmin)
 */
async function getFunnelData(filters, userId, isAdmin) {
  const { whereClause, values } = buildFilter(filters, userId, isAdmin);
  const q = `
    SELECT status AS stage_name, COUNT(*)::int AS count
    FROM leads
    ${whereClause}
    GROUP BY status
    ORDER BY count DESC
  `;
  try {
    const r = await pool.query(q, values);
    return r.rows.map(rw => ({ stageName: rw.stage_name, count: parseInt(rw.count || 0, 10) }));
  } catch (err) {
    console.error('SQL ERROR getFunnelData:', err.message);
    console.error('Query:', q);
    console.error('Values:', values);
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
    ${whereClause} AND LOWER(status) = 'fechado perdido'
  `;
  const reasonsQuery = `
    SELECT reason_for_loss AS reason, COUNT(*)::int AS count
    FROM leads
    ${whereClause}
    AND LOWER(status) = 'fechado perdido' AND reason_for_loss IS NOT NULL
    GROUP BY reason_for_loss
    ORDER BY count DESC
  `;
  try {
    const [totalLostRes, reasonsRes] = await Promise.all([
      pool.query(totalLostQuery, values),
      pool.query(reasonsQuery, values)
    ]);
    const totalLost = parseInt(totalLostRes.rows[0]?.total_lost || 0, 10);
    const reasons = reasonsRes.rows.map(r => ({ reason: r.reason, count: parseInt(r.count || 0, 10) }));
    return { reasons, totalLost };
  } catch (err) {
    console.error('SQL ERROR getLostReasonsData:', err.message);
    console.error('Values:', values);
    throw err;
  }
}

/**
 * getDailyActivity
 */
async function getDailyActivity(filters, userId, isAdmin) {
  const { whereClause, values } = buildFilter(filters, userId, isAdmin);
  const q = `
    SELECT (created_at::date) AS activity_date, COUNT(*)::int AS leads_created
    FROM leads
    ${whereClause}
    GROUP BY created_at::date
    ORDER BY activity_date ASC
  `;
  try {
    const r = await pool.query(q, values);
    return r.rows.map(row => ({ date: row.activity_date, count: parseInt(row.leads_created || 0, 10) }));
  } catch (err) {
    console.error('SQL ERROR getDailyActivity:', err.message);
    console.error('Query:', q);
    console.error('Values:', values);
    throw err;
  }
}

/**
 * getMapLocations
 * retorna array [{ city, count, lat, lng }]
 * usa lat/lng médios por cidade quando disponíveis
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
      ${whereClause} AND LOWER(status) = 'fechado ganho'
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
      count: parseInt(row.count || 0, 10),
      lat: row.lat ? parseFloat(row.lat) : null,
      lng: row.lng ? parseFloat(row.lng) : null
    }));
  } catch (err) {
    console.error('SQL ERROR getMapLocations:', err.message);
    console.error('Query:', q);
    console.error('Values:', values);
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
    return r.rows || [];
  } catch (err) {
    console.error('SQL ERROR getLeadsForExport:', err.message);
    console.error('Query:', q);
    console.error('Values:', values);
    throw err;
  }
}

/**
 * getAllDashboardData
 */
async function getAllDashboardData(filters = {}, userId = null, isAdmin = false) {
  try {
    const { whereClause, values } = buildFilter(filters, userId, isAdmin);

    const [
      summary,
      funnel,
      lostReasons,
      dailyActivity,
      mapLocations
    ] = await Promise.all([
      getSummaryAndProductivity(whereClause, values),
      getFunnelData(filters, userId, isAdmin),
      getLostReasonsData(filters, userId, isAdmin),
      getDailyActivity(filters, userId, isAdmin),
      getMapLocations(filters, userId, isAdmin)
    ]);

    return {
      globalSummary: summary,
      productivity: { ...summary },
      funnel: funnel,
      lostReasons: lostReasons,
      dailyActivity: dailyActivity,
      mapLocations: mapLocations,
      forecasting: { forecastedKwWeighted: 0 }
    };
  } catch (err) {
    console.error('CRITICAL ERROR getAllDashboardData:', err);
    throw err;
  }
}

module.exports = {
  buildFilter,
  getSummaryAndProductivity,
  getFunnelData,
  getLostReasonsData,
  getDailyActivity,
  getLeadsForExport,
  getMapLocations,
  getAllDashboardData
};
