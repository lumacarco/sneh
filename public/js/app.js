const feed = document.getElementById('feed');
const form = document.getElementById('composer');
const textEl = document.getElementById('text');
const fileEl = document.getElementById('file');
const preview = document.getElementById('preview');
const myPoints = document.getElementById('myPoints');
const myName = document.getElementById('myName');
const emojiPop = document.getElementById('emojiPop');
const live = document.getElementById('live');
let me = null;
let pendingFile = null;

const emojis = '😀😃😄😁😆🥹😂🤣😊😇🙂😉😍😘😗😋😜🤪🤩🥳😎🤓🧐😢😭😤😡🤯😳🫣😱🙏👏🔥❤️💜✨💯👀👍👎🎉🎬🍿🌙⭐'.split(/.*?/u).filter(Boolean);
emojiPop.innerHTML = emojis.map((e) => `<span data-e="${e}">${e}</span>`).join('');
document.getElementById('emojiBtn').onclick = () => emojiPop.classList.toggle('show');
emojiPop.onclick = (e) => { if (e.target.dataset.e) { textEl.value += e.target.dataset.e; textEl.focus(); } };

fileEl.onchange = () => {
  pendingFile = fileEl.files[0] || null;
  preview.textContent = pendingFile ? 'Allegato: ' + pendingFile.name : '';
};

function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function linkify(text) {
  return escapeHtml(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}
function fileBlock(m) {
  if (!m.file) return '';
  if (m.type === 'image') return `<div class="media"><img src="${m.file.src}" alt=""></div>`;
  if (m.type === 'video') return `<div class="media"><video src="${m.file.src}" controls></video><button class="cinema-btn" data-src="${m.file.src}">Modalità cinema</button></div>`;
  return `<a class="filechip" href="${m.file.src}" download="${escapeHtml(m.file.name)}">📄 ${escapeHtml(m.file.name)} · scarica</a>`;
}
function ytBlock(m) {
  if (!m.yt) return '';
  return `<div class="yt"><iframe src="https://www.youtube.com/embed/${m.yt}" allowfullscreen></iframe></div>
    <button class="cinema-btn" data-yt="${m.yt}">Cinema YouTube</button>`;
}
function tripBlock(m) {
  if (!m.trip) return '';
  const t = m.trip;
  return `<a class="trip-chip" href="/viaggio.html?id=${encodeURIComponent(t.id)}">
    <div class="tc-k">${escapeHtml(t.kind || 'viaggio')}</div>
    <div class="tc-t">${escapeHtml(t.title)}</div>
    <div class="tc-p">${escapeHtml(t.place || '')} ${t.date_start ? '· ' + escapeHtml(t.date_start) : ''}</div>
    <div class="tc-a">Apri pagina →</div>
  </a>`;
}
function renderMsg(m) {
  const div = document.createElement('div');
  const mine = me && m.user_id === me.id;
  div.className = 'msg' + (mine ? ' mine' : '');
  const ai = m.ai || { score: 0, comment: '' };
  const cls = ai.score >= 0 ? 'pos' : 'neg';
  const sign = ai.score > 0 ? '+' : '';
  div.innerHTML = `
    <div class="meta">
      <span class="uname" style="color:${m.color}">${escapeHtml(m.name)}</span>
      <span class="upoints" data-uid="${m.user_id}">${m.points} pts</span>
      <span style="color:#666">${new Date(m.created).toLocaleTimeString()}</span>
    </div>
    <div class="bubble">${linkify(m.text || '')}</div>
    ${fileBlock(m)}${ytBlock(m)}${tripBlock(m)}
    <div class="ai-badge"><span class="ai-score ${cls}">IA ${sign}${ai.score}</span><span>${escapeHtml(ai.comment || '')}</span></div>`;
  return div;
}

const socket = io({ transports: ['websocket', 'polling'] });

socket.on('connect', () => { live.textContent = '● live websocket'; });
socket.on('disconnect', () => { live.textContent = '○ riconnessione…'; });
socket.on('ready', (d) => {
  me = d.me;
  myName.textContent = me.name;
  myPoints.textContent = me.points;
});
socket.on('chat:message', (m) => {
  feed.appendChild(renderMsg(m));
  feed.scrollTop = feed.scrollHeight;
});
socket.on('points', (p) => {
  document.querySelectorAll(`[data-uid="${p.id}"]`).forEach((el) => { el.textContent = p.points + ' pts'; });
  if (me && p.id === me.id) myPoints.textContent = p.points;
});

async function boot() {
  const meRes = await fetch('/api/me').then((r) => r.json());
  if (!meRes.ok) { location.href = '/'; return; }
  me = meRes.user;
  myName.textContent = me.name;
  myPoints.textContent = me.points;
  const hist = await fetch('/api/messages').then((r) => r.json());
  if (hist.ok) hist.messages.forEach((m) => feed.appendChild(renderMsg(m)));
  feed.scrollTop = feed.scrollHeight;
}
boot();

form.onsubmit = async (e) => {
  e.preventDefault();
  let file = null;
  let type = 'text';
  if (pendingFile) {
    const fd = new FormData();
    fd.append('file', pendingFile);
    const up = await fetch('/api/upload', { method: 'POST', body: fd }).then((r) => r.json());
    if (!up.ok) { alert(up.error || 'Upload fallito'); return; }
    file = up.file;
    type = up.type;
  }
  const text = textEl.value.trim();
  if (!text && !file) return;
  socket.emit('chat:message', { text, file, type });
  textEl.value = '';
  fileEl.value = '';
  pendingFile = null;
  preview.textContent = '';
  emojiPop.classList.remove('show');
};

textEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.cinema-btn');
  if (!btn) return;
  const inner = document.getElementById('cinemaInner');
  inner.innerHTML = btn.dataset.yt
    ? `<iframe src="https://www.youtube.com/embed/${btn.dataset.yt}?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>`
    : `<video src="${btn.dataset.src}" controls autoplay></video>`;
  document.getElementById('cinema').classList.add('on');
});
document.getElementById('cinemaClose').onclick = () => {
  document.getElementById('cinema').classList.remove('on');
  document.getElementById('cinemaInner').innerHTML = '';
};

document.getElementById('logout').onclick = async (e) => {
  e.preventDefault();
  await fetch('/api/logout', { method: 'POST' });
  location.href = '/';
};

const tripModal = document.getElementById('tripModal');
document.getElementById('tripBtn').onclick = () => tripModal.classList.add('on');
document.getElementById('tripCancel').onclick = () => tripModal.classList.remove('on');
document.getElementById('tripFormChat').onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const r = await fetch('/api/trips', { method: 'POST', body: fd });
  const d = await r.json();
  if (!d.ok) { document.getElementById('terr').textContent = d.error; return; }
  socket.emit('chat:message', {
    text: 'Ho creato una pagina viaggio: ' + d.trip.title,
    trip: { id: d.trip.id, title: d.trip.title, kind: d.trip.kind, place: d.trip.place, date_start: d.trip.date_start }
  });
  tripModal.classList.remove('on');
  e.target.reset();
};
