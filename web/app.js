// Proximia Console — Full Capability Verification
const API = '';
const FIELD_TYPES = ['string','float','int','bool','text','geo'];
let schemaFields = [];
let collectionsCache = [];

// --- Navigation ---
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});
function switchView(name) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.nav-btn[data-view="${name}"]`).classList.add('active');
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
}

// --- Search mode toggle ---
document.getElementById('sr-mode').addEventListener('change', function() {
  document.getElementById('sr-txt-row').style.display = this.value === 'hybrid' ? '' : 'none';
  document.getElementById('sr-alpha').style.display = this.value === 'hybrid' ? '' : 'none';
});

// --- API method toggle ---
document.getElementById('api-method').addEventListener('change', function() {
  document.getElementById('api-body').style.display = this.value === 'POST' ? '' : 'none';
});

// --- Helpers ---
async function api(method, path, body) {
  const opts = { method, headers: {'Content-Type':'application/json'} };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  const text = await res.text();
  try { return { ok: res.ok, data: JSON.parse(text), status: res.status }; }
  catch(e) { return { ok: res.ok, data: text, status: res.status }; }
}
function esc(s) { return s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function short(v) { return typeof v === 'number' ? v.toFixed(4) : esc(JSON.stringify(v)); }

// --- Populate collection dropdowns ---
async function refreshCollections() {
  const r = await api('GET', '/collections');
  collectionsCache = r.ok ? r.data : [];
  ['dash-table','da-collection','sr-collection','rc-col','ix-col','ex-col'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel || sel.tagName !== 'SELECT') return;
    sel.innerHTML = collectionsCache.map(c => `<option value="${esc(c.name)}">${esc(c.name)} (${c.count})</option>`).join('');
  });
  // Dashboard
  const total = collectionsCache.reduce((s,c) => s + (c.count||0), 0);
  const indexed = collectionsCache.filter(c => c.index_type).length;
  document.getElementById('dash-collections').textContent = collectionsCache.length;
  document.getElementById('dash-vectors').textContent = total.toLocaleString();
  document.getElementById('dash-indexed').textContent = indexed + '/' + collectionsCache.length;
  const tbody = document.getElementById('dash-table');
  if (!collectionsCache.length) { tbody.innerHTML = '<tr><td colspan="5">No collections</td></tr>'; return; }
  tbody.innerHTML = collectionsCache.map(c => `<tr><td><strong>${esc(c.name)}</strong></td><td>${c.count}</td><td>${c.dimension||'—'}</td><td>${esc(c.metric)}</td><td>${c.index_type ? '<span class="badge">'+esc(c.index_type)+'</span>' : '—'}</td></tr>`).join('');
  return collectionsCache;
}

// ======================== SCHEMA DESIGNER ========================
function addField() {
  const name = document.getElementById('sf-name').value.trim();
  if (!name) { alert('Field name required'); return; }
  if (schemaFields.find(f => f.name === name)) { alert('Field already exists'); return; }
  schemaFields.push({ name, type: document.getElementById('sf-type').value, indexable: document.getElementById('sf-indexable').checked });
  document.getElementById('sf-name').value = '';
  document.getElementById('sf-indexable').checked = false;
  renderSchemaFields();
}
function removeField(i) { schemaFields.splice(i,1); renderSchemaFields(); }
function renderSchemaFields() {
  const tb = document.getElementById('sc-fields-body');
  if (!schemaFields.length) { tb.innerHTML = '<tr><td colspan="3">Use the form below to add fields</td></tr>'; return; }
  tb.innerHTML = schemaFields.map((f,i) => `<tr><td>${esc(f.name)}</td><td><span class="badge">${esc(f.type)}</span></td><td>${f.indexable ? '✅' : '—'}</td><td><button onclick="removeField(${i})" class="danger" style="padding:0.2rem 0.5rem">✕</button></td></tr>`).join('');
}
async function createWithSchema() {
  const name = document.getElementById('sc-name').value.trim();
  if (!name) { alert('Collection name required'); return; }
  const metric = document.getElementById('sc-metric').value;
  const enableIndex = document.getElementById('sc-index').checked;
  const body = { name, metric, enable_index: enableIndex };
  if (schemaFields.length) body.schema = { fields: schemaFields.map(f => ({ name: f.name, type: f.type, indexable: f.indexable })) };
  const r = await api('POST', '/collections', body);
  document.getElementById('sc-result').textContent = JSON.stringify(r.data, null, 2);
  if (r.ok) { schemaFields = []; renderSchemaFields(); refreshCollections(); }
}

// ======================== DATA MANAGER ========================
async function loadDataDocs() {
  const col = document.getElementById('da-collection').value;
  if (!col) return;
  const r = await api('GET', '/collections');
  if (!r.ok) return;
  const c = r.data.find(x => x.name === col);
  document.getElementById('da-stats').textContent = c ? `count=${c.count} dim=${c.dimension||'?'} metric=${c.metric}` : '';
}
async function doUpsert() {
  const col = document.getElementById('da-collection').value;
  const id = document.getElementById('da-id').value.trim();
  const vecStr = document.getElementById('da-vec').value.trim();
  const metaStr = document.getElementById('da-meta').value.trim();
  if (!col || !id || !vecStr) { alert('Collection, ID, and vector required'); return; }
  const vector = vecStr.split(',').map(s => parseFloat(s.trim()));
  if (vector.some(isNaN)) { alert('Invalid vector'); return; }
  let metadata = {};
  if (metaStr) { try { metadata = JSON.parse(metaStr); } catch(e) { alert('Invalid metadata JSON'); return; } }
  const r = await api('POST', `/collections/${encodeURIComponent(col)}/upsert`, { id, vector, metadata });
  document.getElementById('da-result').textContent = JSON.stringify(r.data, null, 2);
  if (r.ok) { loadDataDocs(); refreshCollections(); }
}
async function doBatchUpsert() {
  const col = document.getElementById('da-collection').value;
  const raw = document.getElementById('da-batch').value.trim();
  if (!col || !raw) { alert('Collection and documents required'); return; }
  let docs; try { docs = JSON.parse(raw); } catch(e) { alert('Invalid JSON: '+e.message); return; }
  if (!Array.isArray(docs)) { alert('Must be an array'); return; }
  const r = await api('POST', `/collections/${encodeURIComponent(col)}/batch-upsert`, { documents: docs });
  document.getElementById('da-batch-result').textContent = JSON.stringify(r.data, null, 2);
  if (r.ok) { loadDataDocs(); refreshCollections(); }
}

// ======================== SEARCH LAB ========================
async function doSearch() {
  const col = document.getElementById('sr-collection').value;
  const mode = document.getElementById('sr-mode').value;
  const k = parseInt(document.getElementById('sr-k').value) || 5;
  if (!col) { alert('Select a collection'); return; }

  if (mode === 'vector') {
    const vec = document.getElementById('sr-vec').value.trim().split(',').map(s => parseFloat(s.trim()));
    if (vec.some(isNaN)) { alert('Invalid query vector'); return; }
    let filter = {};
    const filterStr = document.getElementById('sr-filter').value.trim();
    if (filterStr) { try { filter = JSON.parse(filterStr); } catch(e) { alert('Invalid filter JSON'); return; } }
    const r = await api('POST', `/collections/${encodeURIComponent(col)}/search`, { query: vec, k, filter });
    renderSearchResults(r.data);
  } else {
    const vec = document.getElementById('sr-vec').value.trim().split(',').map(s => parseFloat(s.trim()));
    if (vec.some(isNaN)) { alert('Invalid query vector'); return; }
    const text = document.getElementById('sr-txt').value.trim();
    if (!text) { alert('Text query required for hybrid search'); return; }
    const alpha = parseFloat(document.getElementById('sr-alpha').value) || 0.5;
    let filter = {};
    const filterStr = document.getElementById('sr-filter').value.trim();
    if (filterStr) { try { filter = JSON.parse(filterStr); } catch(e) { alert('Invalid filter JSON'); return; } }
    const r = await api('POST', `/collections/${encodeURIComponent(col)}/hybrid-search`, { query: vec, text_query: text, k, alpha, filter });
    renderSearchResults(r.data);
  }
}
function renderSearchResults(data) {
  const area = document.getElementById('sr-results');
  const body = document.getElementById('sr-body');
  const bars = document.getElementById('sr-bars');
  const stats = document.getElementById('sr-stats');
  const results = data.results || [];
  area.style.display = '';
  stats.textContent = `${results.length} results in ${((data.total_time_ns||0)/1e6).toFixed(2)}ms${data.index_used ? ' | index: '+data.index_used : ''}`;
  if (!results.length) { body.innerHTML = '<tr><td colspan="4">No results</td></tr>'; bars.innerHTML = ''; return; }
  body.innerHTML = results.map((r,i) => `<tr><td>${i+1}</td><td><strong>${esc(r.id)}</strong></td><td>${r.score.toFixed(6)}</td><td>${r.document && r.document.metadata ? esc(JSON.stringify(r.document.metadata)) : '—'}</td></tr>`).join('');
  const maxS = Math.max(...results.map(r=>r.score)), minS = Math.min(...results.map(r=>r.score)), range = maxS-minS||1;
  bars.innerHTML = '<h3>Score Distribution</h3>'+results.map(r => {
    const pct = ((r.score-minS)/range*100);
    return `<div class="score-bar"><span class="score-bar-label">${esc(r.id)}</span><div class="score-bar-fill" style="width:${Math.max(pct,2)}%"></div><span>${r.score.toFixed(4)}</span></div>`;
  }).join('');
}

// ======================== RECALL ANALYZER ========================
async function doRecall() {
  const col = document.getElementById('rc-col').value;
  const vec = document.getElementById('rc-vec').value.trim().split(',').map(s => parseFloat(s.trim()));
  const k = parseInt(document.getElementById('rc-k').value) || 10;
  if (!col || vec.some(isNaN)) { alert('Valid collection and query vector required'); return; }
  const r = await api('POST', `/collections/${encodeURIComponent(col)}/recall`, { query: vec, k });
  if (!r.ok) { alert('Error: '+JSON.stringify(r.data)); return; }
  const d = r.data;

  // Metrics
  document.getElementById('rc-metrics').style.display = '';
  document.getElementById('rc-recall-val').textContent = (d.recall*100).toFixed(1)+'%';
  document.getElementById('rc-ann-lat').textContent = (d.ann_time_ns/1e3).toFixed(1);
  document.getElementById('rc-bf-lat').textContent = (d.bf_time_ns/1e3).toFixed(1);
  const speedup = d.bf_time_ns > 0 && d.ann_time_ns > 0 ? (d.bf_time_ns/d.ann_time_ns).toFixed(1)+'x' : '—';
  document.getElementById('rc-speedup-val').textContent = speedup;

  // Index status
  document.getElementById('rc-ix-status').textContent = d.ann_searched ? `Index: ${d.index_type} | ANN scanned ${d.ann_candidates}/${d.bf_candidates}` : 'No index — comparing BF to BF (recall=100%)';

  // ANN results
  document.getElementById('rc-compare').style.display = '';
  document.getElementById('rc-ann-label').textContent = `(${d.ann_time_ns/1e3}µs, ${d.ann_candidates} candidates)`;
  const bfSet = new Set((d.bf_results||[]).map(x=>x.id));
  const annBody = document.getElementById('rc-ann-body');
  annBody.innerHTML = (d.ann_results||[]).map((x,i) => {
    const match = bfSet.has(x.id);
    return `<tr class="${match?'match-hit':'match-miss'}"><td>${i+1}</td><td>${esc(x.id)}</td><td>${x.score.toFixed(6)}</td><td>${match?'✅':'❌'}</td></tr>`;
  }).join('') || '<tr><td colspan="4">No ANN results</td></tr>';

  const bfBody = document.getElementById('rc-bf-body');
  bfBody.innerHTML = (d.bf_results||[]).map((x,i) => `<tr><td>${i+1}</td><td>${esc(x.id)}</td><td>${x.score.toFixed(6)}</td></tr>`).join('') || '<tr><td colspan="3">No BF results</td></tr>';
}

// ======================== INDEX MANAGER ========================
async function refreshIndex() {
  const col = document.getElementById('ix-col').value;
  if (!col) { document.getElementById('ix-status-txt').textContent = 'Select a collection'; return; }
  const r = await api('GET', `/collections/${encodeURIComponent(col)}/index`);
  if (r.ok) {
    document.getElementById('ix-status-txt').textContent = r.data.index_type ? `🟢 ${r.data.index_type}` : '🔴 No index';
    document.getElementById('ix-info').textContent = JSON.stringify(r.data, null, 2);
  }
}
async function doBuildIndex(type) {
  const col = document.getElementById('ix-col').value;
  if (!col) { alert('Select a collection'); return; }
  const r = await api('POST', `/collections/${encodeURIComponent(col)}/index`, { action: 'build', index_type: type });
  document.getElementById('ix-info').textContent = JSON.stringify(r.data, null, 2);
  if (r.ok) { refreshIndex(); refreshCollections(); }
}
async function doDropIndex() {
  const col = document.getElementById('ix-col').value;
  if (!col || !confirm(`Drop index on "${col}"?`)) return;
  const r = await api('POST', `/collections/${encodeURIComponent(col)}/index`, { action: 'drop' });
  document.getElementById('ix-info').textContent = JSON.stringify(r.data, null, 2);
  if (r.ok) { refreshIndex(); refreshCollections(); }
}
document.getElementById('ix-col').addEventListener('change', refreshIndex);

// ======================== QUERY EXPLAINER ========================
async function doExplain() {
  const col = document.getElementById('ex-col').value;
  const vec = document.getElementById('ex-vec').value.trim().split(',').map(s => parseFloat(s.trim()));
  const k = parseInt(document.getElementById('ex-k').value) || 5;
  if (!col || vec.some(isNaN)) { alert('Valid collection and query required'); return; }
  let filter = {};
  const filterStr = document.getElementById('ex-filter').value.trim();
  if (filterStr) { try { filter = JSON.parse(filterStr); } catch(e) { alert('Invalid filter JSON'); return; } }
  const r = await api('POST', `/collections/${encodeURIComponent(col)}/explain`, { query: vec, k, filter });
  if (!r.ok) { alert(JSON.stringify(r.data)); return; }
  const d = r.data;
  document.getElementById('ex-report').style.display = '';
  const body = document.getElementById('ex-body');
  body.innerHTML = `
    <tr><td>Index Type</td><td>${esc(d.index_type||'None (brute force)')}</td></tr>
    <tr><td>Search Time</td><td>${(d.search_time_ns/1e6).toFixed(3)} ms</td></tr>
    <tr><td>Top-K Requested</td><td>${d.top_k}</td></tr>
    <tr><td>Candidates Evaluated</td><td>${d.candidates}</td></tr>
    <tr><td>Results Returned</td><td>${d.results_returned}</td></tr>
    <tr><td>Filter Applied</td><td>${esc(d.filter_applied||'None')}</td></tr>
    <tr><td>Query Vector</td><td style="font-family:monospace;font-size:0.8rem">[${(d.query||[]).map(v=>v.toFixed(4)).join(', ')}]</td></tr>`;
  const rbody = document.getElementById('ex-results-body');
  const res = d.results||[];
  rbody.innerHTML = res.length ? res.map((x,i) => `<tr><td>${i+1}</td><td>${esc(x.id)}</td><td><strong>${x.score.toFixed(6)}</strong></td><td>${x.document&&x.document.metadata?esc(JSON.stringify(x.document.metadata)):'—'}</td></tr>`).join('') : '<tr><td colspan="4">No results</td></tr>';
}

// ======================== API PLAYGROUND ========================
async function sendAPI() {
  const method = document.getElementById('api-method').value;
  let path = document.getElementById('api-path').value.trim();
  if (!path.startsWith('/')) path = '/' + path;
  let body;
  if (method === 'POST') {
    const raw = document.getElementById('api-body').value.trim();
    if (raw) { try { body = JSON.parse(raw); } catch(e) { alert('Invalid JSON body'); return; } }
  }
  // Show curl command
  let curl = `curl -s -X ${method} http://localhost:8080${path}`;
  if (method === 'POST') curl += ` \\\n  -H 'Content-Type: application/json' \\\n  -d '${JSON.stringify(body)}'`;
  document.getElementById('api-curl-cmd').textContent = curl;

  const r = await api(method, path, body);
  document.getElementById('api-response').textContent = JSON.stringify(r.data, null, 2);
}

// ======================== INIT ========================
async function init() {
  await refreshCollections();
  // Periodic refresh for dashboard
  setInterval(refreshCollections, 10000);
}
init();
