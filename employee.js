const PRODUCTS = {
  'ДК': ['ТП', 'Курьер'],
  'КН': ['ББО', 'ЛК', 'ТП'],
  'КК': ['ББО', 'ЛК', 'ТП'],
};

const state = {
  id: null,
  fio: null,
  openProduct: null,
  lastSale: null, // {product, subtype, ts}
  todaySales: [],
};

const app = document.getElementById('app');

async function init() {
  state.id = getParam('id');
  if (!state.id) {
    app.innerHTML = `<div class="empty">Ссылка недействительна.<br>Обратитесь к администратору.</div>`;
    return;
  }

  try {
    const res = await api('getEmployee', { id: state.id });
    if (!res.ok) {
      app.innerHTML = `<div class="empty">Ссылка недействительна.<br>Обратитесь к администратору.</div>`;
      return;
    }
    state.fio = res.fio;
    render();
    loadToday();
  } catch (e) {
    app.innerHTML = `<div class="empty">Ошибка соединения.<br>Проверьте интернет и обновите.</div>`;
  }
}

function render() {
  const firstName = state.fio.split(' ')[1] || state.fio.split(' ')[0];
  app.innerHTML = `
    <div class="greeting">Здравствуйте, ${escapeHtml(firstName)}
      <span>${escapeHtml(state.fio)}</span>
    </div>

    <div id="products"></div>

    <h2>Мои продажи за сегодня</h2>
    <div id="today"></div>
  `;

  const productsEl = document.getElementById('products');
  Object.keys(PRODUCTS).forEach((product) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.product = product;
    card.innerHTML = `
      <div class="card-head">
        <span>${product}</span>
        <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>
      <div class="card-body">
        <div>
          <div class="subtypes">
            ${PRODUCTS[product].map((s) =>
              `<button class="subtype-btn" data-product="${product}" data-subtype="${s}">${s}</button>`
            ).join('')}
          </div>
        </div>
      </div>
    `;
    card.querySelector('.card-head').addEventListener('click', () => toggleCard(product));
    productsEl.appendChild(card);
  });

  productsEl.querySelectorAll('.subtype-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const product = e.currentTarget.dataset.product;
      const subtype = e.currentTarget.dataset.subtype;
      addSale(product, subtype, e.currentTarget);
    });
  });
}

function toggleCard(product) {
  const card = document.querySelector(`.card[data-product="${product}"]`);
  const wasOpen = card.classList.contains('open');
  document.querySelectorAll('.card.open').forEach((c) => c.classList.remove('open'));
  if (!wasOpen) card.classList.add('open');
}

async function addSale(product, subtype, btn) {
  // Клиентская защита от дубля
  if (state.lastSale &&
      state.lastSale.product === product &&
      state.lastSale.subtype === subtype &&
      Date.now() - state.lastSale.ts < 15000) {
    const ok = confirm(`Уже записано ${Math.round((Date.now() - state.lastSale.ts) / 1000)} сек назад.\nДобавить ещё раз?`);
    if (!ok) return;
  }

  btn.disabled = true;
  try {
    const res = await api('addSale', {
      id: state.id,
      product,
      subtype,
      key: uuid(),
    });
    if (!res.ok) {
      toast('Не удалось записать: ' + (res.error || 'ошибка'));
      return;
    }
    state.lastSale = { product, subtype, ts: Date.now() };
    const saleId = res.saleId;
    toast(`Записано: ${product} · ${subtype}`, {
      duration: 5000,
      action: {
        label: 'Отменить',
        onClick: async () => {
          await api('deleteSale', { id: state.id, saleId });
          toast('Запись удалена');
          loadToday();
        },
      },
    });
    loadToday();
  } catch (e) {
    toast('Ошибка сети. Попробуйте ещё раз.');
  } finally {
    btn.disabled = false;
  }
}

async function loadToday() {
  const el = document.getElementById('today');
  if (!el) return;
  try {
    const res = await api('getTodaySales', { id: state.id });
    if (!res.ok) {
      el.innerHTML = `<div class="empty">Не удалось загрузить</div>`;
      return;
    }
    if (!res.sales.length) {
      el.innerHTML = `<div class="empty">Пока ничего не записано</div>`;
      return;
    }
    el.innerHTML = res.sales.map((s) => `
      <div class="list-item">
        <div>
          <div class="main">${escapeHtml(s.product)} · ${escapeHtml(s.subtype)}</div>
          <div class="sub">${escapeHtml(s.time)}</div>
        </div>
        <div class="actions">
          <button class="btn btn-sm btn-danger" data-sale="${s.saleId}">Удалить</button>
        </div>
      </div>
    `).join('');

    el.querySelectorAll('[data-sale]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const saleId = btn.dataset.sale;
        if (!confirm('Удалить эту запись?')) return;
        const r = await api('deleteSale', { id: state.id, saleId });
        if (r.ok) { toast('Удалено'); loadToday(); }
        else toast('Не удалось удалить');
      });
    });
  } catch (e) {
    el.innerHTML = `<div class="empty">Ошибка сети</div>`;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

init();