# Recipe Sharing Platform 🍲

A full-stack, authenticated Recipe Sharing web application built with Node.js, Express, Handlebars, and PostgreSQL, deployed using production-hardened Docker containers with automated database migrations and encrypted remote database syncing.

---

## Architecture Overview

```text
+------------------------------------+                    +------------------------------------------------------+
|    CLIENT MACHINE (Linux Laptop)   |                    |               PRODUCTION SERVER (Linux / WSL 2)      |
|                                    |                    |                                                      |
|  - Local Dev (`npm run dev`)       |    HTTPS (443)     |  [ Reverse Proxy: Nginx / Nginx Proxy Manager ]       |
|  - Push Deploy (`npm run deploy`)  | -----------------> |       │ (forwards to 127.0.0.1:3000)                 |
|  - Pull DB (`npm run db:pull`)     |                    |       ▼                                              |
|                                    |    SSH (48222)     |  [ App Container ] (Node 20, non-root, read-only)   |
|                                    | -----------------> |       │                                              |
|                                    |                    |       ▼ (internal bridge network: db:5432)           |
|                                    |                    |  [ Database Container ] (PostgreSQL 16, volume)      |
+------------------------------------+                    +------------------------------------------------------+
```

### Key Security & Architecture Features
- **Multi-Stage Container Build**: Compiler build-tools (`g++`, `make`, `python3`) are isolated to the build stage and discarded from runtime, keeping the image minimal and hardened.
- **Unprivileged Execution**: The Node.js application runs under the unprivileged `node` user (`UID 1000`). Root execution is disabled.
- **Read-Only Root Filesystem**: The container filesystem is mounted `read_only: true`. Temporary runtime storage is provided via an isolated in-memory `tmpfs` (`/tmp:noexec,nosuid,size=64m`).
- **Capability Hardening**: Drops all Linux kernel capabilities (`cap_drop: [ ALL ]`) and enforces `no-new-privileges:true`.
- **Localhost-Only Port Bindings**: Ports `3000` (Node.js) and `5432` (PostgreSQL) are bound strictly to `127.0.0.1` on the host, preventing the public internet from bypassing the reverse proxy or accessing the raw database.
- **Automatic Database Migrations**: Self-contained migrations auto-create the database and tables on container startup via `docker/docker-entrypoint.sh` only after the PostgreSQL service reports healthy.

---

## Table of Contents
1. [Server Setup: Native Linux VPS](#1-server-setup-native-linux-vps)
2. [Server Setup: Windows Host with WSL 2](#2-server-setup-windows-host-with-wsl-2)
3. [Reverse Proxy Configuration (Nginx / Nginx Proxy Manager)](#3-reverse-proxy-configuration)
4. [Client Setup: Linux Laptop (Development & Sync)](#4-client-setup-linux-laptop)
5. [Deploying & Operations](#5-deploying--operations)

---

## 1. Server Setup: Native Linux VPS

Follow this section if your production server is running standalone Linux (Ubuntu, Debian, etc.).

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

# Create production environment file from server template
cp server_template.env .env
chmod 600 .env
nano .env
```

Ensure your `.env` has a strong database password:
```env
NODE_ENV=production
PORT=3000
RUN_MIGRATIONS=true

DB_HOST=db
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD="your_strong_random_password"
DB_NAME=recipe_db
```

### Step 1.4: Launch the Production Stack
```bash
docker compose up -d --build
docker compose ps
```
Both `recipe_app` and `recipe_db` will report status `Up (healthy)`.

---

## 2. Server Setup: Windows Host with WSL 2

Follow this section if your production or homelab server runs on Windows with WSL 2.

### Step 2.1: Enable WSL Integration in Docker Desktop
1. Open **Docker Desktop** on Windows.
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

### Step 2.3: Forward the SSH Port in Windows
Because Windows owns the physical network card, inbound traffic hits Windows first. 

To route port 48222 directly into your WSL distribution:
1. Open File Explorer in Windows and browse to the project's `scripts/` folder.
2. **Right-click `setup-wsl-portforward.ps1` &rarr; Run with PowerShell**.
3. The script automatically self-elevates to Administrator, detects the current internal WSL IP, adds the Windows Firewall rule, and configures `netsh portproxy`.

### Step 2.4: Deploy in WSL
Inside your WSL terminal:
```bash
mkdir -p ~/docker_services
cd ~/docker_services
git clone <repository-url> recipe-sharing-platform
cd recipe-sharing-platform

cp server_template.env .env
chmod 600 .env
nano .env

docker compose up -d --build
docker compose ps
```

---

## 3. Reverse Proxy Configuration

The application listens internally on `127.0.0.1:3000`. A reverse proxy handles public TLS/SSL encryption and forwards traffic to the application.

### Option A: Using Nginx Proxy Manager (GUI)
1. Open your Nginx Proxy Manager dashboard (default port `81`).
2. Navigate to **Proxy Hosts -> Add Proxy Host**:
   - **Domain Names**: `recipes.your-domain.com`
   - **Scheme**: `http`
   - **Forward Hostname / IP**: `127.0.0.1` (or host LAN IP)
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

Follow this section to set up your local development environment on your Linux laptop.

### Step 4.1: Clone & Install Dependencies
```bash
git clone <repository-url> recipe-sharing-platform
cd recipe-sharing-platform

# Install Node.js dependencies
npm install

# Ensure scripts are executable
chmod +x ./scripts/*.sh
```

### Step 4.2: Authorize Your SSH Key with the Server
Install your laptop's SSH public key on the production server so that deployments and database syncs do not require entering a password:
```bash
# Generate an SSH key if you do not have one yet
ssh-keygen -t ed25519 -C "laptop-dev"

# Copy key to your server
ssh-copy-id -p 48222 <server-user>@<server-ip-or-domain>
```

### Step 4.3: Configure Local `.env`
Copy the client template:
```bash
cp client_template.env .env
nano .env
```

Configure your local database credentials and remote SSH connection:
```env
NODE_ENV=development
PORT=3000
RUN_MIGRATIONS=false

# Local Database Connection (Linux socket or localhost)
DB_HOST=/run/postgresql
DB_PORT=5432
DB_USER=admin
DB_PASSWORD="your_local_db_password"
DB_NAME=recipe_db

# Remote Production Server (for npm run db:pull & npm run deploy)
PROD_SSH_HOST=<server-user>@<server-ip-or-domain>
PROD_SSH_PORT=48222
PROD_DB_NAME=recipe_db
PROD_DB_USER=postgres
```

### Step 4.4: Initialize Local Database (Choose One)

You can populate your local database in one of two ways:

* **Option A: Pull real data from production (`npm run db:pull`)**
  ```bash
  npm run db:pull
  ```
  The script automatically creates `recipe_db` locally if it doesn't exist, establishes an encrypted SSH pipe, dumps the production database, and restores it locally.

* **Option B: Start fresh with empty tables (`npm run migrate`)**
  ```bash
  npm run migrate
  ```
  The migration runner auto-creates `recipe_db` locally via `migrations/000_create_database.sql` and applies all migration files (`001` through `008`).

### Step 4.5: Run Local Development Server
```bash
npm run dev
```
Starts the local server on `http://localhost:3000` with **automatic hot-reloading (`--watch`)**. Any edits to templates, routes, or models restart the server instantly.

---

## 5. Deploying & Operations

### Deploying to Production (From Laptop)
Once you have merged your pull request into the `master` branch on GitHub:
```bash
npm run deploy
```
This command:
1. Connects to your production server over SSH.
2. Ensures the server is on `master` and pulls the latest merged code (`git pull origin master`).
3. Rebuilds and reloads the Docker containers with zero downtime (`docker compose build --pull && docker compose up -d`).
4. Prunes old container images and prints container health status.
*(Note: It does not push any local branches—it assumes code has already been merged into `master`).*

### Accessing Production via SSH Tunnel (From Laptop)
To view or test the production website securely in your laptop browser without opening port 3000 to the public:
```bash
npm run tunnel
```
This forwards `http://localhost:8080` on your laptop directly to `127.0.0.1:3000` on your production server. Open `http://localhost:8080` in your browser. Press `Ctrl+C` whenever you want to close the tunnel.

*(Optional: forward to a custom local port, e.g. `npm run tunnel -- 9000`).*

### Manual Server-Side Deploy
If you are logged directly into the production server, you can trigger updates using:
```bash
./scripts/deploy.sh
```

### Changing the Database Password
To update the PostgreSQL password on an active server:
1. Update the password inside PostgreSQL:
   ```bash
   docker compose exec db psql -U postgres -d recipe_db -c "ALTER USER postgres WITH PASSWORD '<NewSecurePassword>';"
   ```
2. Update `DB_PASSWORD=<NewSecurePassword>` in your server's `.env`.
3. Restart the web app:
   ```bash
   docker compose restart app
   ```

### Viewing Production Logs
```bash
# Web application logs
docker compose logs -f app

# PostgreSQL database logs
docker compose logs -f db
```

---

## License
MIT
