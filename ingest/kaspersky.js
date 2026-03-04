const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = process.env.KSC_BASE_URL; // e.g. https://ksc.example.com:13299
const TOKEN = process.env.KSC_API_KEY || process.env.KSC_TOKEN;
const TOKEN_SCHEME = (process.env.KSC_TOKEN_SCHEME || "KSCT").trim(); 
const VSERVER = process.env.KSC_VSERVER || null;
const INSECURE = (process.env.KSC_INSECURE || 'false').toLowerCase() === 'true';

if (!BASE_URL || !TOKEN) {
  console.error('Missing env vars. Set KSC_BASE_URL and KSC_API_KEY (or KSC_TOKEN).');
  process.exit(1);
}

const agent = BASE_URL.startsWith('https://')
  ? new https.Agent({ rejectUnauthorized: !INSECURE, keepAlive: true })
  : undefined;

function kscUrl(method) {
  return new URL(`/api/v1.0/${method}`, BASE_URL).toString();
}

async function kscCall(method, params, sessionId) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (VSERVER) headers['X-KSC-VServer'] = Buffer.from(VSERVER, 'utf8').toString('base64');
  if (sessionId) headers['X-KSC-Session'] = sessionId;

  const res = await fetch(kscUrl(method), {
    method: 'POST',
    headers,
    body: JSON.stringify(params || {}),
    agent
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`KSC API error ${res.status}: ${body}`);
  }

  return res.json();
}

async function startSession() {
  const res = await fetch(kscUrl('Session.StartSession'), {
    method: 'POST',
    headers: (() => {
      const hdrs = {
        'Authorization': `${TOKEN_SCHEME} ${TOKEN}`,
        'Content-Type': 'application/json'
      };
      if (VSERVER) hdrs['X-KSC-VServer'] = Buffer.from(VSERVER, 'utf8').toString('base64');
      return hdrs;
    })(),
    body: JSON.stringify({}),
    agent
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`KSC session error ${res.status}: ${body}`);
  }

  const json = await res.json();
  return json.PxgRetVal;
}

async function endSession(sessionId) {
  if (!sessionId) return;
  try {
    await kscCall('Session.EndSession', {}, sessionId);
  } catch (_) {
    // ignore
  }
}

async function chunkFetch(accessorId, sessionId, batchSize = 1000) {
  const countRes = await kscCall('ChunkAccessor.GetItemsCount', {
    strAccessor: accessorId
  }, sessionId);
  const total = countRes.PxgRetVal || 0;
  const items = [];

  for (let start = 0; start < total; start += batchSize) {
    const chunkRes = await kscCall('ChunkAccessor.GetItemsChunk', {
      strAccessor: accessorId,
      nStart: start,
      nCount: Math.min(batchSize, total - start)
    }, sessionId);
    const chunk = (chunkRes.pChunk && chunkRes.pChunk.KLCSP_ITERATOR_ARRAY) || [];
    items.push(...chunk);
  }

  await kscCall('ChunkAccessor.Release', { strAccessor: accessorId }, sessionId);
  return items;
}

async function findHosts(sessionId) {
  const filter = process.env.KSC_HOSTS_FILTER || '';
  const fields = (process.env.KSC_HOSTS_FIELDS || 'KLHST_WKS_HOSTNAME,KLHST_WKS_DN,KLHST_WKS_OS_NAME,KLHST_WKS_STATUS')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const res = await kscCall('HostGroup.FindHosts', {
    wstrFilter: filter,
    vecFieldsToReturn: fields,
    vecFieldsToOrder: [],
    pParams: { KLGRP_FIND_FROM_CUR_VS_ONLY: true },
    lMaxLifeTime: 3600
  }, sessionId);

  const accessor = res.strAccessor;
  if (!accessor) return [];
  return chunkFetch(accessor, sessionId);
}

async function findIncidents(sessionId) {
  const filter = process.env.KSC_INCIDENTS_FILTER || '';
  const fields = (process.env.KSC_INCIDENTS_FIELDS || 'KLINCDT_ID,KLINCDT_SEVERITY,KLINCDT_ADDED,KLHST_WKS_HOSTNAME,KLINCDT_TYPE_DISPLAY_NAME,KLINCDT_IS_HANDLED')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const res = await kscCall('HostGroup.FindIncidents', {
    strFilter: filter,
    pFieldsToReturn: fields,
    pFieldsToOrder: [{ Name: 'KLINCDT_ADDED', Asc: false }],
    lMaxLifeTime: 3600
  }, sessionId);

  const accessor = res.strAccessor;
  if (!accessor) return [];
  return chunkFetch(accessor, sessionId);
}

async function findEvents(sessionId) {
  const filter = process.env.KSC_EVENTS_FILTER || '';
  const fields = (process.env.KSC_EVENTS_FIELDS || 'event_db_id,GNRL_EA_SEVERITY,hostname,product_name,product_version,event_type,hostdn')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const res = await kscCall('SrvView.ResetIterator', {
    wstrViewName: 'EventsSrvViewName',
    wstrFilter: filter,
    vecFieldsToReturn: fields,
    vecFieldsToOrder: [{ Name: 'event_db_id', Asc: false }],
    pParams: {},
    lifetimeSec: 3600
  }, sessionId);

  const iteratorId = res.wstrIteratorId;
  if (!iteratorId) return [];

  const countRes = await kscCall('SrvView.GetRecordCount', { wstrIteratorId: iteratorId }, sessionId);
  const total = countRes.PxgRetVal || 0;
  const items = [];

  for (let start = 0; start < total; start += 1000) {
    const end = Math.min(start + 999, total - 1);
    const chunkRes = await kscCall('SrvView.GetRecordRange', {
      wstrIteratorId: iteratorId,
      nStart: start,
      nEnd: end
    }, sessionId);
    const chunk = (chunkRes.pRecords && chunkRes.pRecords.KLCSP_ITERATOR_ARRAY) || [];
    items.push(...chunk);
  }

  await kscCall('SrvView.ReleaseIterator', { wstrIteratorId: iteratorId }, sessionId);
  return items;
}

function toWeekRange(date = new Date()) {
  const end = new Date(date);
  const start = new Date(date);
  start.setDate(start.getDate() - 7);
  const toISO = (d) => d.toISOString().slice(0, 10);
  return `${toISO(start)} to ${toISO(end)}`;
}

function normalize(hosts, incidents, events) {
  const devicesTotal = hosts.length;
  const devicesProtected = hosts.filter((h) => h.KLHST_WKS_STATUS !== 0 && h.KLHST_WKS_STATUS !== 'offline').length;
  const devicesUnprotected = Math.max(0, devicesTotal - devicesProtected);

  const threatsBlocked = events.length; // refine with event_type filter for blocked events
  const incidentsTotal = incidents.length;

  const recentIncidents = incidents.slice(0, 10).map((i) => ({
    id: `INC-${i.KLINCDT_ID}`,
    severity: String(i.KLINCDT_SEVERITY),
    status: i.KLINCDT_IS_HANDLED ? 'Resolved' : 'Open',
    provider: 'Kaspersky',
    endpoint: i.KLHST_WKS_HOSTNAME || i.KLHST_WKS_DN || '—',
    opened: i.KLINCDT_ADDED ? String(i.KLINCDT_ADDED).slice(0, 10) : '—'
  }));

  return {
    range: toWeekRange(),
    providers: ['Kaspersky'],
    kpis: {
      devices_total: devicesTotal,
      devices_protected: devicesProtected,
      devices_unprotected: devicesUnprotected,
      threats_blocked: threatsBlocked,
      incidents_total: incidentsTotal,
      mtta_hours: 0,
      mttr_hours: 0,
      agent_health_ok_pct: devicesTotal ? Math.round((devicesProtected / devicesTotal) * 1000) / 10 : 0,
      policy_compliance_pct: 0,
      risk_score_avg: 0
    },
    weekly_trend: [],
    severity: [],
    coverage_by_provider: [
      { provider: 'Kaspersky', protected: devicesProtected, total: devicesTotal }
    ],
    top_threat_families: [],
    top_noisy_endpoints: [],
    recent_incidents: recentIncidents
  };
}

async function main() {
  const sessionId = await startSession();
  try {
    const [hosts, incidents, events] = await Promise.all([
      findHosts(sessionId),
      findIncidents(sessionId),
      findEvents(sessionId)
    ]);

    const summary = normalize(hosts, incidents, events);

    const outPath = path.join(__dirname, '..', 'data', 'weekly.generated.json');
    fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
    console.log(`Saved ${outPath}`);
  } finally {
    await endSession(sessionId);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
