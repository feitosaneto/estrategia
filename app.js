// ===== FIREBASE CONFIG =====
// 1. Acesse https://console.firebase.google.com
// 2. Crie um projeto → Firestore Database → Criar banco de dados (modo produção ou teste)
// 3. Vá em Configurações do projeto → Seus apps → Adicionar app Web
// 4. Cole as credenciais abaixo:
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDr1UfCEyPbp8xcBnuY9A-SFHdR5PXmQkQ",
  authDomain: "estrategia-cae9a.firebaseapp.com",
  projectId: "estrategia-cae9a",
  storageBucket: "estrategia-cae9a.firebasestorage.app",
  messagingSenderId: "97503333550",
  appId: "1:97503333550:web:f35d5b64111a21a4c8713f",
  measurementId: "G-T63JQWFVSH"
};

// ===== DATA =====
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const ICONS = ['🚀', '💡', '🎯', '📊', '🔧', '⚙️', '🌱', '🤝', '💼', '📈', '🏆', '🔍', '💬', '🛡️', '🌐', '📦', '🔗', '✅', '🧩', '⭐'];

const DEFAULT_METAS = [150000, 160000, 180000, 190000, 200000, 200000, 200000, 210000, 210000, 230000, 230000, 240000];

const DATA_VERSION = 2;
const LS_KEY = 'estrategia2026';

function defaultData() {
  return {
    year: 2026,
    meta: 2400000,
    password: 'supera',
    projects: Array.from({ length: 14 }, (_, i) => ({
      id: i + 1,
      name: `Projeto ${i + 1}`,
      description: '',
      icon: ICONS[i] || '🚀',
      imageData: null
    })),
    months: MONTHS.map((m, i) => ({
      name: m,
      meta: DEFAULT_METAS[i],
      realizado: null,
      justificativa: ''
    }))
  };
}

function migrateData(parsed) {
  if (!parsed._v || parsed._v < DATA_VERSION) {
    const allZero = parsed.months && parsed.months.every(m => m.meta === 0);
    if (allZero) {
      parsed.months = parsed.months.map((m, i) => ({ ...m, meta: DEFAULT_METAS[i] }));
    }
    parsed._v = DATA_VERSION;
  }
  return parsed;
}

// ===== FIREBASE SETUP =====
let db = null;
let dataDocRef = null;
let unsubscribeListener = null;
const FIREBASE_ENABLED = !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);

async function initFirebase() {
  if (!FIREBASE_ENABLED) return false;
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getFirestore, doc, getDoc, setDoc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    const firebaseApp = initializeApp(FIREBASE_CONFIG);
    db = getFirestore(firebaseApp);
    dataDocRef = doc(db, 'estrategia', 'dados2026');

    // Guarda funções do Firestore para uso posterior
    window._firestoreSetDoc = setDoc;
    window._firestoreOnSnapshot = onSnapshot;
    return true;
  } catch (e) {
    console.warn('Erro ao inicializar Firebase:', e);
    return false;
  }
}

async function loadFromFirestore() {
  try {
    const { getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const snap = await getDoc(dataDocRef);
    if (snap.exists()) {
      return migrateData(snap.data());
    }
  } catch (e) {
    console.warn('Erro ao carregar do Firestore:', e);
  }
  return null;
}

async function saveToFirestore(data) {
  try {
    await window._firestoreSetDoc(dataDocRef, data);
    return true;
  } catch (e) {
    console.error('Erro ao salvar no Firestore:', e);
    return false;
  }
}

function startRealtimeListener() {
  if (!dataDocRef || !window._firestoreOnSnapshot) return;
  // Cancela listener anterior se existir
  if (unsubscribeListener) unsubscribeListener();

  unsubscribeListener = window._firestoreOnSnapshot(dataDocRef, (snap) => {
    if (snap.exists()) {
      const newData = migrateData(snap.data());
      // Só atualiza se não estiver no painel admin (evita sobrescrever edições em andamento)
      if (document.getElementById('admin-panel').classList.contains('hidden')) {
        DATA = newData;
        localStorage.setItem(LS_KEY, JSON.stringify(DATA));
        renderPage();
      }
    }
  });
}

// ===== LOCAL STORAGE (fallback / cache) =====
function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return migrateData(JSON.parse(raw));
  } catch (e) { }
  return null;
}

// ===== GLOBAL DATA =====
let DATA = defaultData();

// ===== NOTIFICATION =====
function notify(msg) {
  let el = document.getElementById('__notify');
  if (!el) {
    el = document.createElement('div');
    el.className = 'notify';
    el.id = '__notify';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

// ===== LOADING STATE =====
function showLoading(show) {
  let el = document.getElementById('__loading');
  if (!el) {
    el = document.createElement('div');
    el.id = '__loading';
    el.style.cssText = `
      position:fixed;top:0;left:0;right:0;bottom:0;
      background:rgba(240,245,251,0.85);
      display:flex;align-items:center;justify-content:center;
      z-index:9999;font-family:Inter,sans-serif;
      flex-direction:column;gap:16px;
    `;
    el.innerHTML = `
      <div style="width:48px;height:48px;border:4px solid #dce8f5;border-top-color:#2563a8;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
      <div style="color:#1a3a6b;font-weight:600;font-size:15px;">Carregando dados...</div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    `;
    document.body.appendChild(el);
  }
  el.style.display = show ? 'flex' : 'none';
}

// ===== ADMIN AUTH =====
function openAdminLogin() {
  document.getElementById('admin-login-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('admin-pwd-input').focus(), 100);
}
function closeAdminLogin() {
  document.getElementById('admin-login-modal').classList.add('hidden');
  document.getElementById('admin-pwd-input').value = '';
  document.getElementById('login-error').classList.add('hidden');
}
function loginAdmin() {
  const val = document.getElementById('admin-pwd-input').value;
  if (val === DATA.password) {
    closeAdminLogin();
    openAdmin();
  } else {
    document.getElementById('login-error').classList.remove('hidden');
  }
}
function exitAdmin() {
  document.getElementById('admin-panel').classList.add('hidden');
  document.getElementById('main-page').classList.remove('hidden');
}
function openAdmin() {
  document.getElementById('main-page').classList.add('hidden');
  document.getElementById('admin-panel').classList.remove('hidden');
  renderAdminProjects();
  renderAdminMonths();
  document.getElementById('cfg-year').value = DATA.year;
  document.getElementById('cfg-meta').value = DATA.meta;
  document.getElementById('cfg-pwd').value = DATA.password;
  updateMetaHint();
}

// ===== ADMIN: Config =====
document.getElementById('cfg-meta').addEventListener('input', updateMetaHint);
function updateMetaHint() {
  const v = parseFloat(document.getElementById('cfg-meta').value) || 0;
  document.getElementById('cfg-meta-hint').textContent = `80% = ${formatBRL(v * 0.8)}`;
}

// ===== ADMIN: Projects =====
function renderAdminProjects() {
  const grid = document.getElementById('projects-admin-grid');
  grid.innerHTML = '';
  DATA.projects.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'proj-admin-card';
    const previewContent = p.imageData
      ? `<img src="${p.imageData}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`
      : p.icon;
    div.innerHTML = `
      <div class="proj-admin-title">Projeto ${String(i + 1).padStart(2, '0')}</div>
      <div class="proj-admin-fields">
        <div class="field-group">
          <label>Título</label>
          <input type="text" id="p-name-${i}" value="${escHtml(p.name)}" placeholder="Nome do projeto">
        </div>
        <div class="field-group">
          <label>Descrição</label>
          <textarea id="p-desc-${i}" rows="3" placeholder="Descreva brevemente o projeto...">${escHtml(p.description)}</textarea>
        </div>
        <div class="field-group">
          <label>Imagem / Ícone</label>
          <div class="img-upload-section">
            <div class="img-upload-row">
              <div class="img-preview-box" id="img-preview-${i}">${previewContent}</div>
              <div class="img-upload-controls">
                <input type="file" class="real-file-input" id="p-img-${i}" accept="image/png,image/jpeg,image/webp" onchange="handleImageUpload(${i}, this)">
                <label for="p-img-${i}" class="btn-upload-img">📁 Enviar imagem PNG</label>
                ${p.imageData ? `<button type="button" class="btn-clear-img" onclick="clearImage(${i})">✕ Remover imagem</button>` : ''}
                <span class="img-upload-hint">PNG, JPG ou WebP</span>
              </div>
            </div>
            <div class="icon-label" style="margin-top:6px">Ou escolha um ícone emoji:</div>
            <div class="icon-picker" id="ip-${i}">
              ${ICONS.map(ic => `<button type="button" class="icon-opt${p.icon === ic ? ' selected' : ''}" onclick="selectIcon(${i},'${ic}')" title="${ic}">${ic}</button>`).join('')}
            </div>
          </div>
        </div>
      </div>`;
    grid.appendChild(div);
  });
}

function selectIcon(projIdx, icon) {
  DATA.projects[projIdx].icon = icon;
  const picker = document.getElementById(`ip-${projIdx}`);
  picker.querySelectorAll('.icon-opt').forEach(btn => {
    btn.classList.toggle('selected', btn.textContent.trim() === icon);
  });
}

function handleImageUpload(idx, input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    DATA.projects[idx].imageData = e.target.result;
    const box = document.getElementById(`img-preview-${idx}`);
    if (box) {
      box.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`;
    }
    const ctrl = input.parentElement;
    if (ctrl && !ctrl.querySelector('.btn-clear-img')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-clear-img';
      btn.textContent = '✕ Remover imagem';
      btn.onclick = () => clearImage(idx);
      ctrl.insertBefore(btn, ctrl.querySelector('.img-upload-hint'));
    }
  };
  reader.readAsDataURL(file);
}

function clearImage(idx) {
  DATA.projects[idx].imageData = null;
  renderAdminProjects();
}

// ===== ADMIN: Months =====
function renderAdminMonths() {
  const grid = document.getElementById('months-admin-grid');
  grid.innerHTML = '';
  DATA.months.forEach((m, i) => {
    const div = document.createElement('div');
    div.className = 'month-admin-card';
    div.innerHTML = `
      <div class="month-admin-title">${m.name}</div>
      <div class="month-admin-row">
        <div class="field-group">
          <label>Meta (R$)</label>
          <input type="number" id="m-meta-${i}" value="${m.meta}" placeholder="0">
        </div>
        <div class="field-group">
          <label>Realizado (R$)</label>
          <input type="number" id="m-real-${i}" value="${m.realizado !== null ? m.realizado : ''}" placeholder="—">
        </div>
        <div class="field-group">
          <label>Justificativa</label>
          <input type="text" id="m-just-${i}" value="${escHtml(m.justificativa)}" placeholder="Sem justificativa...">
        </div>
      </div>`;
    grid.appendChild(div);
  });
}

// ===== SAVE =====
async function saveAll() {
  // Config
  DATA.year = parseInt(document.getElementById('cfg-year').value) || 2026;
  DATA.meta = parseFloat(document.getElementById('cfg-meta').value) || 0;
  DATA.password = document.getElementById('cfg-pwd').value || 'supera';

  // Projects
  DATA.projects.forEach((p, i) => {
    p.name = document.getElementById(`p-name-${i}`).value;
    p.description = document.getElementById(`p-desc-${i}`).value;
  });

  // Months
  DATA.months.forEach((m, i) => {
    m.meta = parseFloat(document.getElementById(`m-meta-${i}`).value) || 0;
    const rv = document.getElementById(`m-real-${i}`).value;
    m.realizado = rv === '' ? null : parseFloat(rv);
    m.justificativa = document.getElementById(`m-just-${i}`).value;
  });

  DATA._v = DATA_VERSION;

  // Sempre salva no localStorage como cache
  localStorage.setItem(LS_KEY, JSON.stringify(DATA));

  let savedRemote = false;
  if (FIREBASE_ENABLED && dataDocRef) {
    const btn = document.querySelector('.btn-save');
    const originalText = btn.textContent;
    btn.textContent = '⏳ Salvando...';
    btn.disabled = true;

    savedRemote = await saveToFirestore(DATA);

    btn.textContent = originalText;
    btn.disabled = false;
  }

  renderPage();

  if (FIREBASE_ENABLED) {
    notify(savedRemote ? '✅ Dados salvos e publicados!' : '⚠️ Salvo localmente (erro no servidor)');
  } else {
    notify('✅ Dados salvos localmente!');
  }

  exitAdmin();
}

// ===== MAIN PAGE RENDER =====
function renderPage() {
  renderProjects();
  renderGauge();
  renderMonthlyDetail();
}

// ===== PROJECTS =====
function renderProjects() {
  const grid = document.getElementById('projects-grid');
  grid.innerHTML = '';
  DATA.projects.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'project-card';
    const iconContent = p.imageData
      ? `<img src="${p.imageData}" alt="${escHtml(p.name)}">`
      : p.icon;
    card.innerHTML = `
      <div class="project-icon">${iconContent}</div>
      <div class="project-num">Projeto ${String(i + 1).padStart(2, '0')}</div>
      <div class="project-name">${escHtml(p.name)}</div>
      ${p.description
        ? `<div class="project-desc">${escHtml(p.description)}</div>`
        : `<div class="project-empty">Sem descrição cadastrada.</div>`}`;
    grid.appendChild(card);
  });
}

// ===== GAUGE =====
function renderGauge() {
  const meta = DATA.meta;
  const meses = DATA.months;
  const monthsWithData = meses.filter(m => m.realizado !== null);
  const totalReal = monthsWithData.reduce((s, m) => s + m.realizado, 0);
  const pct = meta > 0 ? (totalReal / meta) * 100 : 0;
  const ganho80 = meta * 0.8;

  document.getElementById('gauge-pct').textContent = pct.toFixed(1).replace('.', ',') + '%';
  document.getElementById('gauge-val').textContent = formatBRL(totalReal);
  document.getElementById('gauge-meta-label').textContent = `${formatBRL(meta)} · ${DATA.year}`;
  document.getElementById('kpi-meta').textContent = formatBRL(meta);
  document.getElementById('kpi-meta-sub').textContent = `80% = ${formatBRL(ganho80)} = GANHO`;
  document.getElementById('kpi-pct').textContent = pct.toFixed(1).replace('.', ',') + '%';
  document.getElementById('kpi-realizado').textContent = formatBRL(totalReal);
  document.getElementById('kpi-falta').textContent = `Falta: ${formatBRL(Math.max(0, meta - totalReal))}`;
  document.getElementById('kpi-ganho').textContent = formatBRL(Math.max(0, ganho80 - totalReal));
  document.getElementById('kpi-months-info').textContent = `${monthsWithData.length} de 12 meses com dados`;
  document.getElementById('prog-pct').textContent = pct.toFixed(1).replace('.', ',') + '%';

  const badge = document.getElementById('kpi-status');
  badge.className = 'status-badge';
  if (pct >= 80) { badge.textContent = 'Ganho'; badge.classList.add('status-ganho'); }
  else if (pct >= 50) { badge.textContent = 'Atenção'; badge.classList.add('status-atencao'); }
  else if (monthsWithData.length === 0) { badge.textContent = 'Pendente'; badge.classList.add('status-pendente'); }
  else { badge.textContent = 'Atenção'; badge.classList.add('status-atencao'); }

  const fillEl = document.getElementById('progress-fill');
  fillEl.style.width = Math.min(pct, 100) + '%';

  drawGauge(pct, meta, meses);
  renderMonthlyBars(meta, meses);
}

function drawGauge(pct, metaTotal, meses) {
  const canvas = document.getElementById('gaugeCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2, cy = H - 55;
  const outerR = Math.min(W, H * 1.6) * 0.44;
  const innerR = outerR * 0.55;
  const segCount = 12;
  const gap = 0.025;
  const segSpan = (Math.PI - gap * (segCount + 1)) / segCount;

  const maxMeta = Math.max(...meses.map(m => m.meta), 1);

  for (let i = 0; i < segCount; i++) {
    const angle = Math.PI - gap * (i + 1) - segSpan * i;
    const a1 = angle;
    const a2 = angle - segSpan;
    const m = meses[i];
    const monthPct = m.realizado !== null && m.meta > 0 ? m.realizado / m.meta : 0;
    const relOuter = innerR + (outerR - innerR) * (m.meta > 0 ? (m.meta / maxMeta) * 0.85 + 0.15 : 0.2);

    ctx.beginPath();
    ctx.moveTo(cx + innerR * Math.cos(a1), cy + innerR * Math.sin(a1) * -1);
    ctx.arc(cx, cy, innerR, -a1, -a2, false);
    ctx.lineTo(cx + relOuter * Math.cos(a2), cy + relOuter * Math.sin(a2) * -1);
    ctx.arc(cx, cy, relOuter, -a2, -a1, true);
    ctx.closePath();
    ctx.fillStyle = '#dce8f5';
    ctx.fill();

    if (m.realizado !== null && m.realizado > 0) {
      const fillR = innerR + (relOuter - innerR) * Math.min(monthPct, 1);
      ctx.beginPath();
      ctx.moveTo(cx + innerR * Math.cos(a1), cy + innerR * Math.sin(a1) * -1);
      ctx.arc(cx, cy, innerR, -a1, -a2, false);
      ctx.lineTo(cx + fillR * Math.cos(a2), cy + fillR * Math.sin(a2) * -1);
      ctx.arc(cx, cy, fillR, -a2, -a1, true);
      ctx.closePath();
      const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, fillR);
      grad.addColorStop(0, '#4fa8d8');
      grad.addColorStop(1, '#2563a8');
      ctx.fillStyle = grad;
      ctx.fill();
    }

    const midAngle = (a1 + a2) / 2;
    const labelR = relOuter + 26;
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy - labelR * Math.sin(midAngle);
    ctx.save();
    ctx.translate(lx, ly);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#5a7090';
    ctx.font = '600 10px Inter,sans-serif';
    ctx.fillText(MONTH_ABBR[i], 0, -8);
    ctx.fillStyle = '#1a3a6b';
    ctx.font = '700 10px Inter,sans-serif';
    ctx.fillText(m.meta > 0 ? formatK(m.meta) : '—', 0, 4);
    ctx.restore();
  }

  const grad2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR * 0.9);
  grad2.addColorStop(0, '#e8f4ff');
  grad2.addColorStop(1, '#c8dff5');
  ctx.beginPath();
  ctx.arc(cx, cy, innerR - 4, 0, Math.PI * 2);
  ctx.fillStyle = grad2;
  ctx.fill();
  ctx.strokeStyle = '#b0cce8';
  ctx.lineWidth = 2;
  ctx.stroke();

  const needleAngle = Math.PI - (pct / 100) * Math.PI;
  const nx = cx + (innerR * 0.85) * Math.cos(needleAngle);
  const ny = cy - (innerR * 0.85) * Math.sin(needleAngle);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(nx, ny);
  ctx.strokeStyle = '#1a3a6b';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#1a3a6b';
  ctx.fill();

  const markerAngle = Math.PI - 0.8 * Math.PI;
  ctx.beginPath();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = '#27ae60';
  ctx.lineWidth = 2;
  const m80x1 = cx + innerR * Math.cos(markerAngle);
  const m80y1 = cy - innerR * Math.sin(markerAngle);
  const m80x2 = cx + (outerR + 18) * Math.cos(markerAngle);
  const m80y2 = cy - (outerR + 18) * Math.sin(markerAngle);
  ctx.moveTo(m80x1, m80y1);
  ctx.lineTo(m80x2, m80y2);
  ctx.stroke();
  ctx.setLineDash([]);
  const badgeAngle = markerAngle - 0.10;
  const badgeLx = cx + (outerR + 85) * Math.cos(badgeAngle);
  const badgeLy = cy - (outerR + 85) * Math.sin(badgeAngle);
  ctx.save();
  ctx.translate(badgeLx, badgeLy);
  ctx.fillStyle = '#d4f4e2';
  const bw = 82, bh = 22;
  ctx.beginPath();
  ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 5);
  ctx.fill();
  ctx.strokeStyle = '#27ae60';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#1a7a40';
  ctx.font = 'bold 10px Inter,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('80% = GANHO', 0, 0);
  ctx.restore();
}

function renderMonthlyBars(metaTotal, meses) {
  const barsEl = document.getElementById('monthly-bars');
  const namesEl = document.getElementById('monthly-names');
  barsEl.innerHTML = '';
  namesEl.innerHTML = '';

  const maxMeta = Math.max(...meses.map(m => m.meta), 1);

  meses.forEach((m, i) => {
    const barH = m.meta > 0 ? (m.meta / maxMeta) * 70 : 10;
    const hasData = m.realizado !== null;
    const isPartial = hasData && m.realizado < m.meta;
    const isFull = hasData && m.realizado >= m.meta;

    const wrap = document.createElement('div');
    wrap.className = 'monthly-bar-wrap';
    wrap.innerHTML = `<div class="monthly-bar${isFull ? ' filled' : isPartial ? ' partial' : ''}" style="height:${barH}px"></div>`;
    barsEl.appendChild(wrap);

    const nm = document.createElement('div');
    nm.className = 'month-name';
    nm.textContent = MONTH_ABBR[i];
    namesEl.appendChild(nm);
  });
}

// ===== MONTHLY DETAIL =====
function renderMonthlyDetail() {
  const list = document.getElementById('monthly-detail-list');
  list.innerHTML = '';
  DATA.months.forEach((m, i) => {
    const pct = m.realizado !== null && m.meta > 0 ? ((m.realizado / m.meta) * 100).toFixed(1) + '%' : '—';
    let status = 'Pendente'; let statusClass = 'status-pendente';
    if (m.realizado !== null) {
      const p = m.meta > 0 ? m.realizado / m.meta : 0;
      if (p >= 0.8) { status = 'Ganho'; statusClass = 'status-ganho'; }
      else if (p >= 0.5) { status = 'Atenção'; statusClass = 'status-atencao'; }
      else { status = 'Perigo'; statusClass = 'status-perigo'; }
    }
    const card = document.createElement('div');
    card.className = 'month-detail-card';
    card.innerHTML = `
      <div class="mdc-top">
        <div class="mdc-month">${m.name}</div>
        <div class="mdc-field"><span class="mdc-field-label">META</span><span class="mdc-field-val">${m.meta > 0 ? formatBRL(m.meta) : '—'}</span></div>
        <div class="mdc-field"><span class="mdc-field-label">REALIZADO</span><span class="mdc-field-val">${m.realizado !== null ? formatBRL(m.realizado) : '—'}</span></div>
        <div class="mdc-field"><span class="mdc-field-label">% DO MÊS</span><span class="mdc-field-val">${pct}</span></div>
        <div class="mdc-field"><span class="mdc-field-label">STATUS</span><span class="status-badge ${statusClass}">${status}</span></div>
      </div>
      <div class="mdc-just">${m.justificativa || 'Sem justificativa para este mês.'}</div>`;
    list.appendChild(card);
  });
}

// ===== HELPERS =====
function formatBRL(n) {
  if (n === null || n === undefined) return '—';
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function formatK(n) {
  if (n >= 1000000) return 'R$ ' + (n / 1000000).toFixed(1).replace('.', ',') + 'M';
  if (n >= 1000) return 'R$ ' + (n / 1000).toFixed(0) + 'K';
  return 'R$ ' + n;
}
function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== EXPÕE FUNÇÕES GLOBAIS (necessário com type="module") =====
window.openAdminLogin = openAdminLogin;
window.closeAdminLogin = closeAdminLogin;
window.loginAdmin = loginAdmin;
window.exitAdmin = exitAdmin;
window.openAdmin = openAdmin;
window.saveAll = saveAll;
window.selectIcon = selectIcon;
window.handleImageUpload = handleImageUpload;
window.clearImage = clearImage;
window.updateMetaHint = updateMetaHint;

// ===== INIT =====
async function init() {
  showLoading(true);

  // Carrega localStorage como cache inicial (resposta imediata)
  const cached = loadFromLocalStorage();
  if (cached) {
    DATA = cached;
    renderPage();
  }

  // Tenta inicializar Firebase e buscar dados atualizados
  const firebaseOk = await initFirebase();

  if (firebaseOk) {
    const remoteData = await loadFromFirestore();
    if (remoteData) {
      DATA = remoteData;
      localStorage.setItem(LS_KEY, JSON.stringify(DATA));
      renderPage();
    } else if (!cached) {
      // Primeiro acesso sem dados remotos: sobe os dados padrão
      DATA = defaultData();
      renderPage();
    }
    // Inicia listener em tempo real
    startRealtimeListener();
  } else if (!cached) {
    DATA = defaultData();
    renderPage();
  }

  showLoading(false);
}

init();
