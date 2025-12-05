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
 */
async function getSummaryAndProductivity(filters, userId, isAdmin) {
  const { whereClause, values } = buildFilter(filters, userId, isAdmin);
  const today = new Date();
  const defaultEnd = format(today, 'yyyy-MM-dd');
  const defaultStart = format(subDays(today, 29), 'yyyy-MM-dd');
  const start = (filters?.startDate) || defaultStart;
  const end = (filters?.endDate) || defaultEnd;
  const dateOnlyValues = [`${start} 00:00:00`, `${end} 23:59:59`];

  const query = `
    SELECT
      COALESCE(COUNT(*), 0) AS total_leads,
      COALESCE(SUM(CASE WHEN LOWER(status) = 'ganho' THEN 1 ELSE 0 END), 0) AS total_won_count,
      COALESCE(SUM(
        CASE 
          WHEN LOWER(status) = 'ganho' AND avg_consumption IS NOT NULL 
          THEN avg_consumption::numeric 
          ELSE 0 
        END
      ), 0) AS total_won_value_kw,
      COALESCE(SUM(CASE WHEN LOWER(status) = 'perdido' THEN 1 ELSE 0 END), 0) AS total_lost_count,
      COALESCE(SUM(CASE WHEN LOWER(status) = 'inapto' THEN 1 ELSE 0 END), 0) AS total_inapto_count,
      COALESCE((SUM(CASE WHEN LOWER(status) = 'ganho' THEN 1 ELSE 0 END)::numeric * 100) / NULLIF(COUNT(*), 0), 0) AS conversion_rate_percent,
      COALESCE((SUM(CASE WHEN LOWER(status) = 'inapto' THEN 1 ELSE 0 END)::numeric * 100) / NULLIF(COUNT(*), 0), 0) AS taxa_inapto_percent
    FROM leads
    ${whereClause}
  `;

  try {
    const [mainResult, notesResult, leadsResult] = await Promise.all([
      pool.query(query, dateOnlyValues),
      pool.query(`
        SELECT COUNT(*) as total
        FROM notes
        WHERE created_at >= $1 AND created_at <= $2
      `, dateOnlyValues),
      pool.query(`SELECT status, created_at, updated_at FROM leads ${whereClause}`, values)
    ]);

    const row = mainResult.rows[0] || {};
    const leads = leadsResult.rows || [];

    // === DADOS NOVOS ===
    const totalInaptoCount = Number(row.total_inapto_count || 0);
    const taxaInapto = Number(row.taxa_inapto_percent || 0);
    const atendimentosRealizados = Number(notesResult.rows[0]?.total || 0);

    // === TEMPO MÉDIO SEGURO (protege contra datas null/inválidas) ===
    const ganhos = leads.filter(l => (l.status || '').toLowerCase() === 'ganho');
    const ativos = leads.filter(l => {
      const s = (l.status || '').toLowerCase();
      return s !== 'ganho' && s !== 'perdido' && s !== 'inapto';
    });

    const calculateAvgHours = (leadsList) => {
      if (!Array.isArray(leadsList) || leadsList.length === 0) return 0;
      let validCount = 0;
      let totalHours = 0;
      for (const l of leadsList) {
        const created = l.created_at ? new Date(l.created_at) : null;
        const updated = l.updated_at ? new Date(l.updated_at) : null;
        if (created && updated && !isNaN(created) && !isNaN(updated) && updated >= created) {
          const diffMs = updated - created;
          totalHours += diffMs / (1000 * 60 * 60);
          validCount++;
        }
      }
      return validCount > 0 ? Number((totalHours / validCount).toFixed(2)) : 0;
    };

    const tempoMedioFechamentoHoras = calculateAvgHours(ganhos);
    const tempoMedioAtendimentoHoras = calculateAvgHours(ativos);

    return {
      totalLeads: Number(row.total_leads || 0),
      totalWonCount: Number(row.total_won_count || 0),
      totalWonValueKW: Number(row.total_won_value_kw || 0),
      totalLostCount: Number(row.total_lost_count || 0),
      totalInaptoCount,
      taxaInapto,
      atendimentosRealizados,
      conversionRate: Number(row.conversion_rate_percent || 0),
      avgClosingTimeDays: 0,
      tempoMedioFechamentoHoras,
      tempoMedioAtendimentoHoras
    };

  } catch (err) {
    console.error('SQL ERROR getSummaryAndProductivity:', err.message);
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

  const query = `
    SELECT 
      COALESCE(NULLIF(TRIM(reason_for_loss), ''), 'Não informado') AS reason_raw,
      COUNT(*)::int AS count
    FROM leads
    ${whereClause}
    AND LOWER(status) = 'perdido'
    GROUP BY reason_raw
    ORDER BY count DESC
  `;

  try {
    const result = await pool.query(query, values);

    const totalLost = result.rows.reduce((sum, r) => sum + Number(r.count), 0);

    const mapaMotivos = {
      'oferta_melhor': 'Oferta Melhor..:',
      'incerteza': 'Incerteza..:',
      'geracao_propria': 'Geração Própria..:',
      'burocracia': 'Burocracia..:',
      'contrato': 'Contrato..:',
      'restricoes_tecnicas': 'Restrições Técnicas..:',
      'nao_responsavel': 'Não é o Responsável..:',
      'silencio': 'Silêncio..:',
      'ja_possui_gd': 'Já Possui GD..:',
      'outro_estado': 'Outro Estado..:',
      'outro': 'Outro..:',
      'não informado': 'Outro..:'
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

    return {
      reasons: reasons.sort((a, b) => b.count - a.count),
      totalLost
    };
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
    console.error('=== ERRO CRÍTICO NO RELATÓRIO COMPLETO ===');
    console.error('Data/hora:', new Date().toISOString());
    console.error('Filtros recebidos:', filters);
    console.error('Usuário ID:', userId, 'isAdmin:', isAdmin);
    console.error('Erro completo:', err); // <--- ESSA LINHA VAI MOSTRAR TUDO
    
    // Opcional: se quiser ver exatamente qual função falhou
    if (err.message) console.error('Mensagem:', err.message);
    if (err.stack) console.error('Stack:', err.stack);

    // Resposta amigável pro frontend (mantém o que já tinha)
    throw err; // ou pode fazer: return { success: false, message: "Erro interno", debug: err.message }
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
