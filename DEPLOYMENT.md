# Quant Tools - Production Deployment Guide

Quick deployment guide for Hetzner VPS (CX33 recommended).

## 📋 Prerequisites

- **Hetzner VPS**: CX33 (4 vCPU, 8GB RAM) - €6.09/month
- **Domain**: DNS configured to point to server IP
- **SSH Access**: Root or sudo user

## 🚀 Quick Deployment

### 1. Server Setup

```bash
# SSH into server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose-plugin -y

# Install Certbot for SSL
apt install certbot python3-certbot-nginx -y
```

### 2. Clone Repository

```bash
# Create app directory
mkdir -p /opt/quant-tools
cd /opt/quant-tools

# Clone repository
git clone <your-repo-url> .

# Or upload files via SCP/SFTP
```

### 3. Configure Environment

```bash
# Create .env file (optional - for sensitive data)
cat > .env <<EOF
POSTGRES_PASSWORD=your_secure_password_here
CORS_ORIGINS=https://your-domain.com
EOF

# Update nginx.prod.conf with your domain
nano nginx/nginx.prod.conf
# Replace 'your-domain.com' with your actual domain
```

### 4. Initial Deployment (HTTP Only)

```bash
# Start services
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

### 5. Setup SSL with Let's Encrypt

```bash
# Stop nginx temporarily
docker compose -f docker-compose.prod.yml stop nginx

# Obtain SSL certificate
certbot certonly --standalone -d your-domain.com

# Uncomment HTTPS server block in nginx/nginx.prod.conf
nano nginx/nginx.prod.conf
# Uncomment lines 77-138 (HTTPS server block)
# Update domain name in ssl_certificate paths

# Restart nginx
docker compose -f docker-compose.prod.yml start nginx

# Setup auto-renewal
echo "0 3 * * * certbot renew --quiet && docker compose -f /opt/quant-tools/docker-compose.prod.yml restart nginx" | crontab -
```

### 6. Verify Deployment

```bash
# Check services
docker compose -f docker-compose.prod.yml ps

# Test API
curl https://your-domain.com/health

# Test frontend
curl -I https://your-domain.com/

# View backend logs
docker compose -f docker-compose.prod.yml logs backend

# Check database
docker exec -it quant_tools_db psql -U quant_user -d quant_tools -c "SELECT COUNT(*) FROM cvd_candles;"
```

## 🔧 Production Configuration

### Environment Variables

Edit `.env` file:

```bash
# Database password (change from default!)
POSTGRES_PASSWORD=your_super_secure_password_123

# CORS origins (your production domain)
CORS_ORIGINS=https://quanttools.example.com,https://www.quanttools.example.com
```

### Nginx Configuration

In `nginx/nginx.prod.conf`:

1. **Replace domain placeholders**:
   - Line 36: `server_name your-domain.com;`
   - Line 81: `server_name your-domain.com;`

2. **Update SSL certificate paths**:
   - Lines 84-85: Replace `your-domain.com` with actual domain

3. **Enable HTTPS redirect**:
   - Uncomment lines 44-46 (HTTP to HTTPS redirect)

4. **Optional: Enable rate limiting**:
   - Uncomment line 19 (rate limit zone)
   - Uncomment line 104 (API rate limiting)

## 📊 Monitoring & Maintenance

### Health Checks

```bash
# All services status
docker compose -f docker-compose.prod.yml ps

# Individual service health
curl https://your-domain.com/health

# Database status
docker exec quant_tools_db pg_isready -U quant_user -d quant_tools
```

### Logs

```bash
# All logs
docker compose -f docker-compose.prod.yml logs -f

# Backend only
docker compose -f docker-compose.prod.yml logs -f backend

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100 backend
```

### Database Backup

```bash
# Create backup
docker exec quant_tools_db pg_dump -U quant_user quant_tools > backup_$(date +%Y%m%d).sql

# Restore from backup
docker exec -i quant_tools_db psql -U quant_user quant_tools < backup_20240101.sql

# Setup automated daily backups
cat > /opt/quant-tools/backup.sh <<'EOF'
#!/bin/bash
docker exec quant_tools_db pg_dump -U quant_user quant_tools | gzip > /opt/quant-tools/backups/backup_$(date +%Y%m%d_%H%M%S).sql.gz
find /opt/quant-tools/backups -name "backup_*.sql.gz" -mtime +7 -delete
EOF

chmod +x /opt/quant-tools/backup.sh
echo "0 2 * * * /opt/quant-tools/backup.sh" | crontab -
```

## 🔄 Updates & Rollback

### Update Application

```bash
cd /opt/quant-tools

# Pull latest changes
git pull

# Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build

# Verify
docker compose -f docker-compose.prod.yml ps
```

### Rollback to Previous Version

```bash
# Stop services
docker compose -f docker-compose.prod.yml down

# Checkout previous commit
git log --oneline  # Find commit hash
git checkout <commit-hash>

# Rebuild and start
docker compose -f docker-compose.prod.yml up -d --build
```

## 🐛 Troubleshooting

### Services Won't Start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs

# Check disk space
df -h

# Check memory
free -m

# Restart services
docker compose -f docker-compose.prod.yml restart
```

### Database Connection Issues

```bash
# Check database logs
docker compose -f docker-compose.prod.yml logs db

# Test connection
docker exec quant_tools_db psql -U quant_user -d quant_tools -c "SELECT 1"

# Reset database (WARNING: deletes all data)
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d
```

### SSL Certificate Issues

```bash
# Test renewal
certbot renew --dry-run

# Manual renewal
certbot renew

# Restart nginx
docker compose -f docker-compose.prod.yml restart nginx
```

## 📈 Performance Tuning

### Database Optimization

```bash
# Increase shared buffers (for 8GB RAM server)
docker exec -it quant_tools_db bash
echo "shared_buffers = 2GB" >> /var/lib/postgresql/data/postgresql.conf
echo "effective_cache_size = 6GB" >> /var/lib/postgresql/data/postgresql.conf
exit

# Restart database
docker compose -f docker-compose.prod.yml restart db
```

### Backend Workers

Edit `docker-compose.prod.yml` line 35:

```yaml
command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

Increase workers based on CPU count (recommended: CPU cores * 2).

## 🔐 Security Checklist

- [ ] Changed default database password
- [ ] SSL certificate installed and auto-renewal configured
- [ ] HTTPS redirect enabled
- [ ] Firewall configured (UFW):
  ```bash
  ufw allow 22/tcp   # SSH
  ufw allow 80/tcp   # HTTP
  ufw allow 443/tcp  # HTTPS
  ufw enable
  ```
- [ ] Regular backups scheduled
- [ ] Security headers enabled in nginx
- [ ] Rate limiting configured (optional)
- [ ] Fail2ban installed (optional):
  ```bash
  apt install fail2ban -y
  systemctl enable fail2ban
  ```

## 💰 Cost Optimization

**Hetzner CX33**: €6.09/month
- 4 vCPU (AMD)
- 8 GB RAM
- 80 GB SSD
- 20 TB traffic

**Alternative: Railway** (~$10-15/month)
- Less control, auto-scaling
- Easier deployment
- Higher cost for similar resources

**Recommendation**: Hetzner CX33 for 35% cost savings with full control.

---

**Support**: [@FedeAnastasi](https://twitter.com/FedeAnastasi)
