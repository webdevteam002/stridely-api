# Oracle Cloud Always Free — NestJS deploy (Stridely)

Target cost: **$0/month**. Supabase remains the PostgreSQL database.

## Always Free shapes (do not pick paid)

- `VM.Standard.E2.1.Micro` (AMD) — up to **2** Always Free instances
- `VM.Standard.A1.Flex` (Ampere ARM) — up to **2 OCPU / 12 GB** total Always Free

If the console only offers paid shapes or shows capacity errors for free shapes, **stop** — do not create a paid VM.

## High-level steps

1. Create/sign in to an Oracle Cloud Free Tier tenancy (Home region with free capacity).
2. Create a VCN with a public subnet + Internet Gateway (Always Free networking).
3. Security list / NSG: allow **TCP 22** (SSH, your IP preferred) and **TCP 443** (HTTPS). Do **not** open Nest’s internal port publicly if Nginx terminates TLS.
4. Launch an Always Free instance (Ubuntu 22.04 or Oracle Linux) with an SSH key you control.
5. On the VM:

```bash
# Node 22 (match backend engines)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx git

git clone https://github.com/webdevteam002/stridely-api.git
cd stridely-api
npm ci
npx prisma generate
npm run build

# Env file (never commit):
sudo mkdir -p /etc/stridely
sudo nano /etc/stridely/api.env   # DATABASE_URL, JWT_SECRET, CORS_ORIGINS, etc.
```

6. systemd unit `/etc/systemd/system/stridely-api.service`:

```ini
[Unit]
Description=Stridely NestJS API
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/stridely-api
EnvironmentFile=/etc/stridely/api.env
ExecStart=/usr/bin/node dist/main.js
Restart=always
RestartSec=5
User=stridely
Group=stridely

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now stridely-api
```

7. Nginx reverse proxy → `127.0.0.1:3000` with Certbot HTTPS (Let’s Encrypt).  
   Without a domain yet: use the VM **public IP** over HTTP temporarily, or point a free DNS name at the IP then Certbot.

8. Point Flutter `LocalSecrets.cloudApiBaseUrl` / `EnvironmentConfig` production URL at `https://…`.

## Health checks

- `GET /health/live`
- `GET /health`
- `GET /health/ready`
