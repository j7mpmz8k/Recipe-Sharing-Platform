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

### Quick Reference: NPM Commands

| Command | Target Environment | Purpose |
| :--- | :--- | :--- |
| **`npm run dev`** | Local Laptop | Runs local Node.js application with automatic hot-reloading (`--watch`) |
| **`npm start`** | Production / Container | Starts Node.js application (`node server.js`) |
| **`npm run migrate`** | Local Laptop | Applies database migrations (auto-creates `recipe_db` if missing) |
| **`npm run db:pull`** | Local Laptop | Encrypted SSH database sync from production PostgreSQL to local machine |
| **`npm run deploy`** | Local Laptop | Triggers automated production deployment of `master` over SSH |
| **`npm run prod:down`** | Local Laptop | Takes down and removes production Docker containers over SSH (`docker compose down`) |
| **`npm run prod:stop`** | Local Laptop | Gracefully stops production Docker containers over SSH (`docker compose stop`) |
| **`npm run prod:start`** | Local Laptop | Starts production Docker containers back up over SSH (`docker compose up -d`) |
| **`npm run tunnel`** | Local Laptop | Forwards remote `127.0.0.1:3000` to local `http://localhost:8080` via SSH |

### Project Structure

```text
├── docker/
│   ├── Dockerfile                  # Hardened multi-stage container build
│   └── docker-entrypoint.sh        # Container entrypoint: runs migrations then node
├── docker-compose.yml              # Root stack orchestration (127.0.0.1 bindings)
├── migrations/                     # SQL schema migrations (000_create_database to 008)
├── public/
│   ├── maintenance.html            # Static downtime fallback page with dark mode
│   ├── styles.css                  # 4-column responsive grid & site theme
│   └── js/                         # Client-side scripts
├── scripts/
│   ├── deploy_prod.sh              # npm run deploy: pull master & rebuild on remote server
│   ├── down_prod.sh                # npm run prod:down: take down production containers
│   ├── stop_prod.sh                # npm run prod:stop: stop production containers
│   ├── start_prod.sh               # npm run prod:start: bring production containers online
│   ├── tunnel_prod.sh              # npm run tunnel: encrypted port-forwarding to port 8080
│   ├── pull_prod_db.sh             # npm run db:pull: encrypted database sync from prod
│   ├── migrate.js                  # Migration runner with auto-database creation
│   └── setup-wsl-portforward.ps1   # Self-elevating PowerShell script for WSL SSH port 48222
├── server_template.env             # Environment template for production server
├── client_template.env             # Environment template for local Linux laptop
└── views/                          # Handlebars templates and user pages
```

---

## Table of Contents
1. [Server Setup: Native Linux VPS](#1-server-setup-native-linux-vps)
2. [Server Setup: Windows Host with WSL 2](#2-server-setup-windows-host-with-wsl-2)
3. [Reverse Proxy Configuration (Nginx / Nginx Proxy Manager)](#3-reverse-proxy-configuration)
4. [Client Setup: Linux Laptop (Development & Sync)](#4-client-setup-linux-laptop)
5. [Deploying, Operations & Git Workflow](#5-deploying-operations--git-workflow)

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

### Step 2.5: Fix Docker Credential Helper in WSL (Required for SSH Deployments)
When Docker Desktop is installed on Windows, it automatically injects `"credsStore": "desktop.exe"` into WSL's `~/.docker/config.json`. When you connect to WSL over **SSH**, the session runs in a clean Linux environment without Windows executable paths, causing Docker builds or image pulls to fail with `docker-credential-desktop.exe: executable file not found in $PATH`.

To prevent this error, reset the Docker config inside WSL:
```bash
echo "{}" > ~/.docker/config.json
```
This allows Docker inside WSL to pull public base images directly over SSH without attempting to invoke Windows executables.

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
   - Agree to terms.
4. Under the **Advanced** tab (Custom Nginx Configuration):
   - To serve a custom maintenance page whenever the Docker container is stopped or restarting (intercepting 502/503/504 errors):
   ```nginx
   proxy_intercept_errors on;
   error_page 502 503 504 /maintenance.html;

   location = /maintenance.html {
       root /data/html;
       internal;
   }
   ```
   *(Place `public/maintenance.html` into your NPM host directory at `~/docker_services/nginx/data/html/maintenance.html`)*.
5. Click **Save**.

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

## 5. Deploying, Operations & Git Workflow

### Git Branching & Release Workflow
This project uses a clean, two-branch workflow:
* **`staging`**: Active development and testing branch.
* **`master`**: Production release branch (mirrored on the production server).

#### Recommended Development & Deployment Cycle:
1. **Develop and test on `staging`**:
   ```bash
   git checkout staging
   # Make your changes and test locally
   npm run dev
   git add <files>
   git commit -m "feat: description of change"
   git push origin staging
   ```

2. **Merge `staging` into `master`**:
   Once tested and ready for production:
   ```bash
   git checkout master
   git merge staging -m "Merge branch 'staging' into master"
   git push origin master
   ```

3. **Deploy `master` to production**:
   ```bash
   npm run deploy
   ```
   *(Connects over SSH, pulls the latest merged `master`, rebuilds containers with `--pull`, and restarts services).*

4. **Switch back to `staging`**:
   ```bash
   git checkout staging
   ```

---

### Deploying to Production (From Laptop)
Once you have pushed your changes to `master` on GitHub:
```bash
npm run deploy
```
This command:
1. Connects to your production server over SSH.
2. Ensures the server is on `master` and pulls the latest merged code (`git pull origin master`).
3. Rebuilds and reloads the Docker containers with zero downtime (`docker compose build --pull && docker compose up -d`).
4. Prunes old container images and prints container health status.
*(Note: It does not push any local branches—it assumes code has already been merged into `master` on GitHub).*

### Production Operations: Stopping, Taking Down & Starting
To safely stop or start the production Docker containers from your laptop over SSH (e.g. for maintenance or testing the Nginx maintenance page):
* **Take down production** (`docker compose down`):
  ```bash
  npm run prod:down
  # Auto-confirm without prompt:
  npm run prod:down -- -y
  ```
  *(Connects via SSH, prompts for confirmation, and runs `docker compose down`)*.
* **Stop production** (`docker compose stop`):
  ```bash
  npm run prod:stop
  # Auto-confirm without prompt:
  npm run prod:stop -- -y
  ```
  *(Connects via SSH, prompts for confirmation, and runs `docker compose stop`)*.
* **Start production** (`docker compose up -d`):
  ```bash
  npm run prod:start
  ```
  *(Connects via SSH and runs `docker compose up -d` to bring containers back online)*.

### Admin Control Center & Platform Features
When logged into an account designated with administrative privileges (`ADMIN_USER_IDS` in `middleware/auth.js`), navigate to **👑 Admin Dashboard** (`/admin`):
* **Real-Time Visitor & Member Analytics**:
  * **Total Visitors Online**: Prominently displayed in green with a live indicator dot; auto-syncs every 10 seconds across all pages in the top navigation header.
  * **Online Members & Guest Visitors**: Separately tracks authenticated members vs. anonymous guests by client IP address (Cloudflare/proxy normalized), eliminating duplicate counting.
  * **Live Traffic & Request Logs**: In-memory circular buffer (capped at 100 entries, 0 DB overhead) capturing request timestamps, client IPs, user handles, HTTP methods, paths, status codes, and latency.
* **Account Invitation System**:
  * **Zero-Jump AJAX Generation**: Generate 48-hour invite links with optional reference names without page reload or jump. Automatically copies the link to your clipboard and inserts the row dynamically.
  * **Retention & Sorting**: Active invites always stay at the top (newest first). Accepted invites move to the bottom, displaying the accepting user and acceptance timestamp, and remain visible for **14 days** before automatic pruning.
  * **Crash-Proof Deletion**: Safely delete any active or accepted invite at any time via AJAX without affecting registered user accounts.
* **Site-Wide Announcement Banners**:
  * Broadcast emergency or informational banners across the top of all site pages with 4 customizable styles (Yellow Warning, Red Alert, Blue Info, Green Announcement).
* **One-Time Password Reset Links**:
  * Generate 48-hour password reset tokens directly from the user table for community members who forget their credentials.
* **4-Column Recipe Grid**:
  * Responsive desktop layout displaying up to 4 recipe cards per row (collapsing cleanly to 3, 2, or 1 column on smaller tablets and mobile screens).

### Accessing Production via SSH Tunnel (From Laptop)
To view or test the production website securely in your laptop browser without opening port 3000 to the public:
```bash
npm run tunnel
```
This forwards `http://localhost:8080` on your laptop directly to `127.0.0.1:3000` on your production server. Open `http://localhost:8080` in your browser. Press `Ctrl+C` whenever you want to close the tunnel.

*(Optional: forward to a custom local port, e.g. `npm run tunnel -- 9000`).*

### Default Admin Account & Password Management
* **Initial Admin Credentials**: On initial database migration, `008_create_admin.sql` seeds the primary administrator account:
  * **Username**: `admin`
  * **Password**: `password`
* **In-App Password Changes**: Any logged-in user can update their password at any time by clicking their name in the top-right header and selecting **`🔐 Change Password`** (`/change-password`). This verifies their current password against the stored bcrypt hash and requires confirming a new password (min. 12 characters).

### Patching & Security Updates
* **Linux Kernel Updates**: Docker containers share the host Linux kernel directly. To patch the kernel, update the host server OS (`sudo apt update && sudo apt upgrade` followed by a system reboot).
* **Container Base Images**: Base images (`node:20-bookworm-slim` and `postgres:16-alpine`) receive upstream OS and runtime patches. Running `npm run deploy` automatically passes `--pull` during `docker compose build` to incorporate the latest base images.

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
