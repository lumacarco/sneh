const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');
const FILES = {
  users: path.join(DATA, 'users.json'),
  messages: path.join(DATA, 'messages.json'),
  trips: path.join(DATA, 'trips.json')
};

if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });
for (const f of Object.values(FILES)) {
  if (!fs.existsSync(f)) fs.writeFileSync(f, '[]');
}

function load(name) {
  try { return JSON.parse(fs.readFileSync(FILES[name], 'utf8')); }
  catch { return []; }
}

function save(name, data) {
  fs.writeFileSync(FILES[name], JSON.stringify(data, null, 2));
}

module.exports = { load, save };
