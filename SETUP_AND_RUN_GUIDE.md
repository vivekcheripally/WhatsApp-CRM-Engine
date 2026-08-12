# 🚀 FastSales WhatsApp Module - Developer Setup & Deployment Guide

This guide provides step-by-step instructions for setting up, configuring, running, and deploying the FastSales WhatsApp CRM & Bulk Campaign Engine.

---

## 📋 Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Environment Configuration (`.env`)](#2-environment-configuration-env)
3. [Running the Application (All Required Terminals)](#3-running-the-application-all-required-terminals)
4. [Meta Developer Dashboard Webhook Setup (Ngrok)](#4-meta-developer-dashboard-webhook-setup-ngrok)
5. [Cloud Production Deployment Notes](#5-cloud-production-deployment-notes)

---

## 1. Prerequisites

Ensure you have the following installed on your machine:
* **Python 3.10+** (with virtual environment support)
* **Node.js 18+** & `npm`
* **Docker Desktop** (for Redis container)
* **PostgreSQL 14+** (running locally or via cloud DB)
* **Ngrok** (for tunneling Meta WhatsApp webhooks during local development)

---

## 2. Environment Configuration (`.env`)

1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Copy the template `.env.example` to create your local `.env` file:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` and fill in your local settings:

| Variable | Description | Example / Required Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:1234@localhost:5432/fastsales_db` |
| `REDIS_URL` | Redis URL for Celery task broker | `redis://localhost:6379/0` |
| `JWT_SECRET_KEY` | Secret key for signing JWT auth tokens | Generate a random 32+ character key |
| `META_VERIFY_TOKEN` | Webhook verification token string | `secure_webhook_verify_key_xyz789` |
| `META_APP_SECRET` | App Secret from Meta Developer Dashboard | Found under Meta App Settings -> Basic |
| `PUBLIC_BASE_URL` | Your Ngrok HTTP tunnel URL | `https://your-ngrok-subdomain.ngrok-free.app` |
| `STORAGE_PROVIDER` | Media storage provider (`local` or `s3`) | Use `local` for dev, `s3` for production |

---

## 3. Running the Application (All Required Terminals)

To run the complete system in development, open **5 separate terminal windows**:

### 💻 Terminal 1: Start Redis (Docker)
Start the Redis background task broker:
```bash
docker run -d -p 6379:6379 --name redis redis:alpine
```
*(If the container is already created, start it using `docker start redis`)*

---

### 🐍 Terminal 2: FastAPI Backend Web Server
Navigate to `backend/`, activate your virtual environment, and launch Uvicorn:
```bash
cd backend
# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# Linux / macOS:
source venv/bin/activate

python -m uvicorn main:app --reload --port 8000
```
* **Swagger API Docs**: Open [http://localhost:8000/docs](http://localhost:8000/docs)

---

### ⚙️ Terminal 3: Celery Background Task Worker
Launch the Celery worker process with `gevent` greenlet concurrency:
```bash
cd backend
.\venv\Scripts\Activate.ps1

python -m celery -A core.celery_app.celery_app worker --loglevel=info -P gevent
```

---

### ⏰ Terminal 4: Celery Beat Cron Scheduler
Launch Celery Beat for scheduled messages & campaigns:
```bash
cd backend
.\venv\Scripts\Activate.ps1

python -m celery -A core.celery_app.celery_app beat --loglevel=info
```

---

### 🌐 Terminal 5: Next.js Frontend App
Navigate to `frontend/` and launch the dev server:
```bash
cd frontend
npm run dev
```
* **Web App Dashboard**: Open [http://localhost:3000](http://localhost:3000)

---

### 🌐 Terminal 6 (Optional): Ngrok Webhook Tunnel
To receive incoming WhatsApp messages & status callbacks from Meta in local dev:
```bash
ngrok http 8000
```
* Copy the generated `https://...ngrok-free.app` URL and set it as `PUBLIC_BASE_URL` in `backend/.env`.

---

## 4. Meta Developer Dashboard Webhook Setup (Ngrok)

To connect your WhatsApp Business Account (WABA) to receive live inbound messages & status updates:

1. Log in to [developers.facebook.com](https://developers.facebook.com/) and open your **WhatsApp App**.
2. Go to **WhatsApp** -> **Configuration** in the left sidebar.
3. Under **Webhook**, click **Edit** / **Configure a Webhook**:
   * **Callback URL**: `https://<your-ngrok-subdomain>.ngrok-free.app/webhook`
   * **Verify Token**: Paste the exact string matching `META_VERIFY_TOKEN` in your `backend/.env` (e.g. `secure_webhook_verify_key_xyz789`).
   * Click **Verify and Save**.
4. Under **Webhook Fields**, click **Manage** and subscribe to:
   * ✅ `messages` *(Inbound customer messages, images, quick replies)*
   * ✅ `message_template_status_update` *(Template approval/rejection updates)*

---

## 5. Cloud Production Deployment Notes

When deploying to AWS, DigitalOcean, or Docker containers:

1. **Environment Variables**:
   Set `STORAGE_PROVIDER=s3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, and `CORS_ORIGINS=["https://your-domain.com"]` in your cloud platform settings.
2. **PostgreSQL Connection**:
   Use a managed PostgreSQL instance (e.g., AWS RDS / DigitalOcean Managed DB) with SSL enabled.
3. **HTTPS Webhook URL**:
   In production, set your Callback URL in Meta Developer Dashboard to your live HTTPS domain: `https://api.yourdomain.com/webhook`.
