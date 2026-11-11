const API_URL = 'https://script.google.com/macros/s/AKfycbxF95hIIS5ZkMNTurholaR7mpOzC8kq3lihotUd0zoo_ElwW7VGcVFJoHHQ6qpUk7eI-g/exec';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(action, params = {}, retries = 3) {
  const qs = new URLSearchParams({ action, ...params });
  const url = `${API_URL}?${qs.toString()}`;

  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'follow', cache: 'no-store' });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        if (i < retries - 1) { await sleep(800 * (i + 1)); continue; }
        throw new Error('Сервер вернул не JSON. Попробуйте ещё раз.');
      }
      return data;
    } catch (err) {
      if (i === retries - 1) throw err;
      await sleep(800 * (i + 1));
    }
  }
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function toast(message, opts = {}) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${message}</span>`;
  if (opts.action) {
    const btn = document.createElement('button');
    btn.textContent = opts.action.label;
    btn.onclick = () => {
      opts.action.onClick();
      el.remove();
    };
    el.appendChild(btn);
  }
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  const ttl = opts.duration || 3000;
  setTimeout(() => {
    el.classList.remove('in');
    setTimeout(() => el.remove(), 250);
  }, ttl);
}

function getParam(name) {
  return new URLSearchParams(location.search).get(name);
}
