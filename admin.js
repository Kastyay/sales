const state = {
  token: sessionStorage.getItem('adminToken') || null,
  employees: [],
  period: 'today',
  from: '',
  to: '',
};

const app = document.getElementById('app');

async function init() {
  if (!state.token) return renderLogin();
  const res = await api('adminEmployees', { token: state.token });
  if (!res.ok) {
    state.token = null;
    sessionStorage.removeItem('adminToken');
    return renderLogin();
  }
  state.employees = res.employees;
  renderApp();
}

function renderLogin() {
  app.innerHTML = `
    <div class="login-wrap">
      <h1 style="margin-bottom:16px;">Админка</h1>
      <div class="field">
        <input type="password" id="pwd" placeholder="Пароль" autocomplete="current-password">
      </div>
      <button class="btn btn-primary btn-block" id="loginBtn">Войти</button>
    </div>
  `;
  const login = async () => {
    const pwd = document.getElementById('pwd').value;
    if (!pwd) return;
    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.textContent = 'Проверка…';
    try {
      const res = await api('adminLogin', { password: pwd });
      if (!res.ok) {
        alert('Неверный пароль');
        btn.disabled = false;
        btn.textContent = 'Войти';
        return;
      }
      state.token = res.token;
      sessionStorage.setItem('adminToken', res.token);
      init();
    } catch {
      alert('Ошибка сети');
      btn.disabled = false;
      btn.textContent = 'Войти';
    }
  };
  document.getElementById('loginBtn').onclick = login;
  document.getElementById('pwd').onkeydown = (e) => { if (e.key === 'Enter') login(); };
}

function renderApp() {
  app.innerHTML = `
    <div class="row-gap" style="justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h1 style="margin:0;">Админка</h1>
      <button class="btn btn-sm" id="logout">Выйти</button>
    </div>

    <div class="tabs">
      <button class="tab active" data-tab="emp">Сотрудники</button>
      <button class="tab" data-tab="today">Сегодня</button>
      <button class="tab" data-tab="stats">Статистика</button>
    </div>

    <div class="tab-panel active" id="panel-emp">
      <button class="btn btn-primary btn-block" id="addEmpBtn">+ Добавить сотрудника</button>
      <div id="empList" class="mt"></div>
    </div>

    <div class="tab-panel" id="panel-today">
      <button class="btn btn-block mb" id="refreshToday">Обновить</button>
      <div id="todayList"></div>
    </div>

    <div class="tab-panel" id="panel-stats">
      <div class="row-gap mb">
        <button class="btn btn-sm period-btn" data-period="today">Сегодня</button>
        <button class="btn btn-sm period-btn" data-period="week">Неделя</button>
        <button class="btn btn-sm period-btn" data-period="month">Месяц</button>
        <button class="btn btn-sm period-btn" data-period="custom">Период</button>
      </div>
      <div id="customPeriod" style="display:none;" class="row-gap mb">
        <input type="date" id="fromDate" style="flex:1;">
        <input type="date" id="toDate" style="flex:1;">
        <button class="btn btn-sm btn-primary" id="applyPeriod">Применить</button>
      </div>
      <div id="statsArea"></div>
    </div>
  `;

  document.getElementById('logout').onclick = () => {
    sessionStorage.removeItem('adminToken');
    state.token = null;
    location.reload();
  };

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.onclick = () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
      if (tab.dataset.tab === 'today') loadToday();
      if (tab.dataset.tab === 'stats') loadStats();
    };
  });

  document.getElementById('addEmpBtn').onclick = addEmployee;
  document.getElementById('refreshToday').onclick = loadToday;
  document.querySelectorAll('.period-btn').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('.period-btn').forEach((b) => b.classList.remove('btn-primary'));
      btn.classList.add('btn-primary');
      state.period = btn.dataset.period;
      document.getElementById('customPeriod').style.display =
        state.period === 'custom' ? 'flex' : 'none';
      if (state.period !== 'custom') loadStats();
    };
  });
  document.querySelector('.period-btn[data-period="today"]').classList.add('btn-primary');
  document.getElementById('applyPeriod').onclick = () => {
    state.from = document.getElementById('fromDate').value;
    state.to = document.getElementById('toDate').value;
    if (!state.from || !state.to) { alert('Укажите обе даты'); return; }
    loadStats();
  };

  renderEmployees();
}

function renderEmployees() {
  const el = document.getElementById('empList');
  if (!state.employees.length) {
    el.innerHTML = `<div class="empty">Список пуст. Добавьте первого сотрудника.</div>`;
    return;
  }
  el.innerHTML = state.employees.map((emp) => `
    <div class="list-item">
      <div style="min-width:0;">
        <div class="main">
          ${escapeHtml(emp.fio)}
          <span class="status-badge status-${emp.status === 'активен' ? 'active' : 'archive'}">
            ${emp.status === 'активен' ? 'активен' : 'архив'}
          </span>
        </div>
      </div>
      <div class="actions">
        ${emp.status === 'активен' ? `
          <button class="btn btn-sm" data-action="copy" data-id="${emp.id}">🔗</button>
          <button class="btn btn-sm" data-action="rename" data-id="${emp.id}">✏️</button>
          <button class="btn btn-sm btn-danger" data-action="archive" data-id="${emp.id}">×</button>
        ` : ''}
      </div>
    </div>
  `).join('');

  el.querySelectorAll('[data-action]').forEach((btn) => {
    btn.onclick = () => handleEmpAction(btn.dataset.action, btn.dataset.id);
  });
}

function empLink(id) {
  const base = location.origin + location.pathname.replace(/admin\.html$/, '');
  return base.replace(/\/$/, '') + '/index.html?id=' + id;
}

async function handleEmpAction(action, id) {
  const emp = state.employees.find((e) => e.id === id);
  if (action === 'copy') {
    const link = empLink(id);
    try {
      await navigator.clipboard.writeText(link);
      toast('Ссылка скопирована');
    } catch {
      prompt('Скопируйте ссылку:', link);
    }
  }
  if (action === 'rename') {
    const newName = prompt('Новое ФИО:', emp.fio);
    if (!newName || newName === emp.fio) return;
    const res = await api('adminRenameEmployee', { token: state.token, id, fio: newName });
    if (res.ok) { emp.fio = newName; renderEmployees(); toast('Сохранено'); }
    else toast('Ошибка: ' + res.error);
  }
  if (action === 'archive') {
    if (!confirm(`Отправить ${emp.fio} в архив? Ссылка перестанет работать.`)) return;
    const res = await api('adminArchiveEmployee', { token: state.token, id });
    if (res.ok) { emp.status = 'архив'; renderEmployees(); toast('В архиве'); }
    else toast('Ошибка: ' + res.error);
  }
}

async function addEmployee() {
  const fio = prompt('ФИО нового сотрудника:');
  if (!fio || !fio.trim()) return;
  const res = await api('adminAddEmployee', { token: state.token, fio: fio.trim() });
  if (!res.ok) { toast('Ошибка: ' + res.error); return; }
  const refresh = await api('adminEmployees', { token: state.token });
  if (refresh.ok) state.employees = refresh.employees;
  renderEmployees();
  toast('Сотрудник добавлен');
}

async function loadToday() {
  const el = document.getElementById('todayList');
  el.innerHTML = `<div class="empty">Загрузка…</div>`;
  try {
    const res = await api('adminTodaySales', { token: state.token });
    if (!res.ok) { el.innerHTML = `<div class="empty">Ошибка: ${res.error}</div>`; return; }
    if (!res.sales.length) { el.innerHTML = `<div class="empty">За сегодня записей нет</div>`; return; }
    el.innerHTML = res.sales.slice().reverse().map((s) => `
      <div class="list-item">
        <div>
          <div class="main">${escapeHtml(s.fio)}</div>
          <div class="sub">${escapeHtml(s.product)} · ${escapeHtml(s.subtype)} — ${escapeHtml(s.time)}</div>
        </div>
        <button class="btn btn-sm btn-danger" data-sale="${s.saleId}">Удалить</button>
      </div>
    `).join('');
    el.querySelectorAll('[data-sale]').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('Удалить эту запись?')) return;
        const r = await api('adminDeleteSale', { token: state.token, saleId: btn.dataset.sale });
        if (r.ok) { toast('Удалено'); loadToday(); }
        else toast('Ошибка: ' + r.error);
      };
    });
  } catch {
    el.innerHTML = `<div class="empty">Ошибка сети</div>`;
  }
}

async function loadStats() {
  const el = document.getElementById('statsArea');
  el.innerHTML = `<div class="empty">Загрузка…</div>`;

  const params = { token: state.token, period: state.period };
  if (state.period === 'custom') { params.from = state.from; params.to = state.to; }

  try {
    const res = await api('getStats', params);
    if (!res.ok) { el.innerHTML = `<div class="empty">Ошибка: ${res.error}</div>`; return; }

    const stats = res.stats || {};
    const names = Object.keys(stats).sort();
    let totalDk = 0, totalKn = 0, totalKk = 0;

    const rows = names.map((fio) => {
      const by = stats[fio].by || {};
      let dk = 0, kn = 0, kk = 0;
      Object.keys(by).forEach((k) => {
        const count = by[k];
        if (k.startsWith('ДК/')) dk += count;
        else if (k.startsWith('КН/')) kn += count;
        else if (k.startsWith('КК/')) kk += count;
      });
      totalDk += dk; totalKn += kn; totalKk += kk;
      return `<tr>
        <td>${escapeHtml(fio)}</td>
        <td class="num">${dk}</td>
        <td class="num">${kn}</td>
        <td class="num">${kk}</td>
        <td class="num total">${dk + kn + kk}</td>
      </tr>`;
    }).join('');

    const rangeLabel = state.period === 'custom'
      ? `${state.from} — ${state.to}`
      : { today: 'сегодня', week: '7 дней', month: '30 дней' }[state.period];

    el.innerHTML = `
      <div style="color:var(--muted);font-size:13px;margin-bottom:12px;">
        Период: ${escapeHtml(rangeLabel)}
      </div>
      ${names.length ? `
        <table class="stats-table">
          <thead>
            <tr><th>Сотрудник</th><th class="num">ДК</th><th class="num">КН</th><th class="num">КК</th><th class="num">Итого</th></tr>
          </thead>
          <tbody>
            ${rows}
            <tr>
              <td class="total">Всего</td>
              <td class="num total">${totalDk}</td>
              <td class="num total">${totalKn}</td>
              <td class="num total">${totalKk}</td>
              <td class="num total">${totalDk + totalKn + totalKk}</td>
            </tr>
          </tbody>
        </table>
      ` : `<div class="empty">За этот период записей нет</div>`}

      <div class="mt">
        <button class="btn btn-primary btn-block" id="exportAll">📥 Выгрузить всех (Excel)</button>
      </div>
    `;

    document.getElementById('exportAll').onclick = () => exportExcel();
  } catch {
    el.innerHTML = `<div class="empty">Ошибка сети</div>`;
  }
}

async function exportExcel() {
  const params = { token: state.token, period: state.period };
  if (state.period === 'custom') { params.from = state.from; params.to = state.to; }
  toast('Готовим файл…', { duration: 2000 });
  try {
    const res = await api('exportPeriod', params);
    if (!res.ok) { toast('Ошибка: ' + res.error); return; }
    window.open(res.url, '_blank');
    toast('Файл готов. Если не скачался — нажмите ещё раз.', { duration: 5000 });
  } catch {
    toast('Ошибка сети');
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

init();
