# Recipe Sharing Platform 🍲

A full-stack, authenticated Recipe Sharing web application built with Node.js, Express, Handlebars, and PostgreSQL, deployed using production-hardened Docker containers with automated database migrations and encrypted remote database syncing.

---

## Architecture Overview

```text
+------------------------------------+                    +------------------------------------------------------+
|    CLIENT MACHINE (Linux Laptop)   |                    |               PRODUCTION SERVER                      |
|                                    |                    |                                                      |
|  - Local Development (`npm dev`)   |    HTTPS (443)     |  [ Reverse Proxy: Nginx / Nginx Proxy Manager ]       |
|  - Database Sync (`npm db:pull`)   | -----------------> |       | (forwards to 127.0.0.1:3000)                 |
|                                    |                    |       ▼                                              |
|                                    |    SSH (48222)     |  [ App Container ] (Node 20, non-root, read-only)   |
|                                    | -----------------> |       │                                              |
|                                    |                    |       ▼ (internal bridge network: db:5432)           |
|                                    |                    |  [ Database Container ] (PostgreSQL 16, volume)      |
+------------------------------------+                    +------------------------------------------------------+
```

### Key Security Features
- **Multi-Stage Build**: Development dependencies and compiler build-tools (`g++`, `make`, `python3`) are discarded after building native modules (`bcrypt`), yielding a minimal attack surface.
- **Unprivileged Execution**: The Node.js application runs under the unprivileged `node` user (`UID 1000`). Root execution is disabled.
- **Read-Only Root Filesystem**: The container root filesystem is mounted `read_only: true`. Temporary runtime storage is provided via an isolated in-memory `tmpfs` (`/tmp:noexec,nosuid,size=64m`).
- **Capability Hardening**: Drops all Linux kernel capabilities (`cap_drop: [ ALL ]`) and enforces `no-new-privileges:true`.
- **Localhost-Only Port Bindings**: Ports `3000` (Node.js) and `5432` (PostgreSQL) are bound strictly to `127.0.0.1` on the host, preventing the public internet from bypassing the reverse proxy or accessing the raw database.
- **Automated Healthchecks**: Built-in container healthchecks monitor HTTP and PostgreSQL readiness. Application migrations run automatically on startup via `docker-entrypoint.sh` only after the database reports healthy.

---

## Table of Contents
1. [Server Setup: Native Linux (Ubuntu / Debian VPS)](#1-server-setup-native-linux-ubuntu--debian-vps)
2. [Server Setup: Windows Host with WSL 2](#2-server-setup-windows-host-with-wsl-2)
3. [Reverse Proxy Configuration (Nginx / Nginx Proxy Manager)](#3-reverse-proxy-configuration)
4. [Client Setup: Linux Laptop (Development & DB Sync)](#4-client-setup-linux-laptop)
5. [Maintenance & Operations](#5-maintenance--operations)

---

## 1. Server Setup: Native Linux (Ubuntu / Debian VPS)

Follow this section if your production server is running standalone Ubuntu or Debian.

### Step 1.1: Install Docker & Docker Compose
```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2 git curl
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
newgrp docker
```

### Step 1.2: Harden SSH & Configure Fail2ban
Internet bots constantly scan port 22. Move SSH to a custom port and disable password authentication.

1. Install OpenSSH and Fail2ban:
   ```bash
   sudo apt install -y openssh-server fail2ban
   ```

2. Edit `/etc/ssh/sshd_config.d/99-hardened.conf` (or `/etc/ssh/sshd_config`):
   ```ini
   Port 48222
   PermitRootLogin no
   PubkeyAuthentication yes
   PasswordAuthentication no
   MaxAuthTries 3
   ```

3. Configure Fail2ban (`/etc/fail2ban/jail.local`):
   ```ini
   [sshd]
   enabled = true
   port = 48222
   filter = sshd
   logpath = /var/log/auth.log
   maxretry = 3
   findtime = 10m
   bantime = 24h
   ```

4. Restart services and configure the firewall:
   ```bash
   sudo systemctl restart ssh
   sudo systemctl enable --now fail2ban

   sudo ufw default deny incoming
   sudo ufw default allow outgoing
   sudo ufw allow 48222/tcp comment "SSH Custom Port"
   sudo ufw allow 80/tcp comment "HTTP (Nginx)"
   sudo ufw allow 443/tcp comment "HTTPS (Nginx)"
   sudo ufw enable
   ```

### Step 1.3: Clone the Repository & Configure Environment
```bash
mkdir -p ~/docker_services
cd ~/docker_services
git clone <repository-url> recipe-sharing-platform
cd recipe-sharing-platform
```

Create `.env`:
```bash
cp .env.example .env
chmod 600 .env
nano .env
```

Set your production variables:
```env
PORT=3000
RUN_MIGRATIONS=true

DB_HOST=db
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=<GenerateAStrongRandomPassword>
DB_NAME=recipe_db
```

### Step 1.4: Add Database Dump Forwarder
To allow the client laptop to run `npm run db:pull` over SSH without exposing the database to the internet:
```bash
sudo tee /usr/local/bin/pg_dump << 'EOF'
#!/bin/sh
docker exec -i recipe_db pg_dump "$@"
EOF
sudo chmod +x /usr/local/bin/pg_dump
```

### Step 1.5: Launch the Production Stack
```bash
docker compose up -d --build
docker compose ps
```
Both `recipe_app` and `recipe_db` will report status `Up (healthy)`.

---

## 2. Server Setup: Windows Host with WSL 2

Follow this section if your server is running on a Windows PC with WSL 2.

### Step 2.1: Enable WSL Integration in Docker Desktop
1. In Windows, open **Docker Desktop**.
2. Go to **Settings -> General** and verify **Use the WSL 2 based engine** is checked.
3. Under **Settings -> Resources -> WSL Integration**, toggle your Linux distribution (e.g. `Ubuntu`) **ON**.

### Step 2.2: Set Up SSH & Fail2ban in WSL
Inside your WSL terminal:
```bash
sudo apt update
sudo apt install -y openssh-server fail2ban

# Configure custom SSH port (48222)
sudo sed -i 's/#Port 22/Port 48222/' /etc/ssh/sshd_config
sudo sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin no/' /etc/ssh/sshd_config
sudo ssh-keygen -A
sudo service ssh restart

# Configure Fail2ban
sudo tee /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
port = 48222
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
findtime = 10m
bantime = 24h
EOF
sudo service fail2ban restart
```

### Step 2.3: Forward the Port in Windows (One Click)
Because Windows owns the physical network card, outside devices connect to the Windows IP. 

Run the automated helper script in Windows:
1. Navigate to your project directory in File Explorer.
2. **Right-click `setup-wsl-portforward.bat` -> Run as Administrator**.
   *(This automatically queries your current WSL IP, adds the Windows Firewall rule for TCP 48222, and configures `netsh portproxy` routing).*

### Step 2.4: Deploy in WSL
Inside WSL:
```bash
mkdir -p ~/docker_services
cd ~/docker_services
git clone <repository-url> recipe-sharing-platform
cd recipe-sharing-platform

cp .env.example .env
chmod 600 .env
nano .env
```
Add the `pg_dump` wrapper:
```bash
sudo tee /usr/local/bin/pg_dump << 'EOF'
#!/bin/sh
docker exec -i recipe_db pg_dump "$@"
EOF
sudo chmod +x /usr/local/bin/pg_dump
```
Start the containers:
```bash
docker compose up -d --build
```

---

## 3. Reverse Proxy Configuration

The application listens internally on `127.0.0.1:3000`. A reverse proxy handles public TLS/SSL encryption and forwards traffic to the application.

### Option A: Using Nginx Proxy Manager (GUI)
1. Open your Nginx Proxy Manager dashboard (default port `81`).
2. Navigate to **Proxy Hosts -> Add Proxy Host**:
   - **Domain Names**: `recipes.your-domain.com`
   - **Scheme**: `http`
   - **Forward Hostname / IP**: `host.docker.internal` (or server LAN IP)
   - **Forward Port**: `3000`
   - Enable: **Block Common Exploits**, **Websockets Support**
3. Under the **SSL** tab:
   - Select **Request a new SSL Certificate** (Let's Encrypt).
   - Check **Force SSL** and **HTTP/2 Support**.
   - Agree to terms and click **Save**.

### Option B: Standalone Nginx Configuration
Create `/etc/nginx/sites-available/recipe-platform`:
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name recipes.your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name recipes.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/recipes.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/recipes.your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/recipe-platform /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 4. Client Setup: Linux Laptop

Follow this section to set up your local development environment on your Linux laptop and enable database syncing.

### Step 4.1: Install Dependencies
```bash
# Clone the repository
git clone <repository-url> recipe-sharing-platform
cd recipe-sharing-platform

# Install Node.js dependencies
npm install

# Make scripts executable
chmod +x ./scripts/*.sh
```

### Step 4.2: Copy SSH Key to the Server
If you haven't already, install your laptop's SSH key on the production server so database syncs do not require entering a password:
```bash
ssh-keygen -t ed25519 -C "laptop-dev"
ssh-copy-id -p 48222 <server-user>@<server-ip-or-domain>
```

### Step 4.3: Configure Local `.env`
Create `.env` in the project root:
```env
# Local Application & Staging Database (Where data is restored TO)
DB_HOST=localhost
DB_PORT=5432
DB_USER=<your-local-laptop-db-user>
DB_PASSWORD=<your-local-laptop-db-password>
DB_NAME=recipe_db
PORT=3000

# Remote Production Server (Where data is pulled FROM)
PROD_SSH_HOST=<server-user>@<server-ip-or-domain>
PROD_SSH_PORT=48222
PROD_DB_NAME=recipe_db
PROD_DB_USER=postgres
```

### Step 4.4: Pull the Production Database to Staging
To clone the production database schema and data into your local staging database:
```bash
npm run db:pull
```
The script will confirm your target, establish an encrypted SSH pipe directly to the remote container, execute `pg_dump`, and restore it locally via `psql`.

### Step 4.5: Run Local Development
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 5. Maintenance & Operations

### Zero-Downtime Server Updates
When you push code updates to Git, update the production server in one command:
```bash
./deploy.sh
```
This script pulls new changes, builds the image with caching, recreates containers with minimal downtime, and prunes orphaned images.

### Changing the Database Password
PostgreSQL volumes retain the password set during initial creation. To change the password on an active server:

1. Update the password inside the live database:
   ```bash
   docker compose exec db psql -U postgres -d recipe_db -c "ALTER USER postgres WITH PASSWORD '<NewSecurePassword>';"
   ```
2. Update `DB_PASSWORD=<NewSecurePassword>` in your server's `.env`.
3. Restart the web application:
   ```bash
   docker compose restart app
   ```

### Viewing Logs
```bash
# Web application logs
docker compose logs -f app

# PostgreSQL database logs
docker compose logs -f db
```

---

## License
MIT
