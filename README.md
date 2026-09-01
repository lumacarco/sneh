# MLA & SNEH

Chat realtime in **Node.js + Socket.io**.

Messaggi istantanei, immagini, GIF, file, YouTube, video in modalità cinema, registrazione, **punti IA** su ogni frase, pagine **viaggio / gita / montagna**.

```
MLA & SNEH
├── server.js          WebSocket + API
├── lib/ai.js          punteggio godimento / moderazione
├── lib/store.js       JSON persistente
└── public/            frontend
```

## Requisiti

- Node.js 18+
- **Non** funziona sul classico hosting Aruba Linux solo PHP  
- Serve **Aruba Cloud / VPS** (Ubuntu) oppure un VPS qualsiasi

## Avvio locale

```bash
git clone https://github.com/TUO-USER/mla-sneh.git
cd mla-sneh
cp .env.example .env
npm install
npm start
```

Apri [http://localhost:3000](http://localhost:3000)

`npm run dev` riavvia da solo se modifichi il server.

## Come è fatta la live

1. Login crea una sessione cookie  
2. Il browser apre **Socket.io** (`websocket`, fallback `polling`)  
3. `chat:message` arriva al server, viene valutato dall’IA, salvato, e **rimbalza a tutti**  
4. Nessun timer ogni 2 secondi  

Upload file: `POST /api/upload` poi il path viaggia sul socket.

## GitHub

1. Crea un repo vuoto `mla-sneh`  
2. Nella cartella del progetto:

```bash
git init
git add .
git commit -m "MLA & SNEH chat websocket"
git branch -M main
git remote add origin https://github.com/TUO-USER/mla-sneh.git
git push -u origin main
```

`node_modules`, `.env`, upload e dati utente sono già nel `.gitignore`.

## Deploy su Aruba Cloud (VPS Ubuntu)

SSH sul server:

```bash
sudo apt update
sudo apt install -y nodejs npm nginx git
git clone https://github.com/TUO-USER/mla-sneh.git /var/www/mla-sneh
cd /var/www/mla-sneh
cp .env.example .env
nano .env          # SESSION_SECRET lungo e casuale
npm install --omit=dev
```

Servizio systemd `/etc/systemd/system/mla-sneh.service`:

```ini
[Unit]
Description=MLA SNEH chat
After=network.target

[Service]
WorkingDirectory=/var/www/mla-sneh
Environment=PORT=3000
Environment=SESSION_SECRET=LA_TUA_CHIAVE
ExecStart=/usr/bin/node server.js
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now mla-sneh
```

Nginx (WebSocket obbligatorio):

```nginx
server {
    server_name tuodominio.it;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        client_max_body_size 40M;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/mla-sneh /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tuodominio.it
```

### Aruba hosting condiviso (solo PHP)

Lì **i WebSocket Node non partono**. Usa il progetto PHP precedente, oppure un VPS da 1–2 €.

## Variabili

| Nome | Default | Ruolo |
|---|---|---|
| `PORT` | `3000` | porta HTTP/WS |
| `SESSION_SECRET` | dev | firma cookie. Cambiala in produzione |

## Licenza

MIT
