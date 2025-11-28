# Quant Tools - Professional Micro Structure Analytics

Enterprise-grade order flow analysis platform with real-time CVD (Cumulative Volume Delta) and LOB (Limit Order Book) density visualization from Hyperliquid.

## 🏗️ Architecture

**Multi-container Docker setup:**
- **PostgreSQL** - TimeSeries storage (CVD candles, LOB snapshots, signals)
- **FastAPI Backend** - WebSocket collector + REST API + database integration
- **React Frontend** - Professional responsive UI (desktop + mobile)
- **Nginx** - Reverse proxy with SSL support

**Key Features:**
- Real-time CVD analysis with signal generation (v1/v2/v3 algorithms)
- LOB density heatmap with support/resistance identification
- TradingView-style chart interactions (drag, zoom, pan)
- Mobile-optimized responsive design
- Background WebSocket collector (Hyperliquid API)
- Optimized database with bulk inserts and caching

## 🚀 Quick Start

### Prerequisites
- Docker + Docker Compose
- Git

### Development Setup

```bash
# Clone and navigate
cd papers/quant_tools

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Access Points

- **Frontend (Nginx)**: http://localhost:8082
- **Frontend (Direct)**: http://localhost:3002
- **Backend API**: http://localhost:8002
- **API Docs**: http://localhost:8002/docs
- **Database**: localhost:5433 (PostgreSQL)

### Database Connection

```
Host: localhost
Port: 5433
Database: quant_tools
User: quant_user
Password: quant_password_2024
```

## 📊 API Endpoints

### CVD Endpoints

```bash
# Get candles with CVD data
GET /api/candles?hours=24&limit=1000

# Get order flow zones (optimal entry/exit)
GET /api/order-flow-zones?symbol=BTC

# Get statistics
GET /api/stats
```

### LOB Density Endpoints

```bash
# Get LOB density heatmap data
GET /api/lob-density?symbol=BTC&hours=720&price_bin=50

# Collector status
GET /api/collector/status

# Health check
GET /health
```

## 🗄️ Database Schema

### cvd_candles Table

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| timestamp | TIMESTAMPTZ | Candle timestamp (unique) |
| symbol | VARCHAR(20) | Trading symbol (default: BTC) |
| price_open/high/low/close | DECIMAL(12,2) | Price OHLC |
| cvd_open/high/low/close | DECIMAL(12,2) | CVD OHLC |
| volume_buy/sell | DECIMAL(12,4) | Buy/sell volume |
| efficiency_ratio | DECIMAL(8,4) | Price/CVD efficiency |
| signal | SMALLINT | Signal (-3 to +3) |
| cumulative_signal | DECIMAL(8,2) | Cumulative signal |
| created_at | TIMESTAMPTZ | Record creation time |

**Indexes:**
- `idx_cvd_candles_timestamp` - Time-series queries
- `idx_cvd_candles_symbol_timestamp` - Symbol + time queries
- `idx_cvd_candles_signal` - Signal filtering (non-zero only)

### Views

- `cvd_stats` - Aggregated statistics (total candles, date range, signal counts)

## 🔧 Configuration

### Environment Variables

**Backend (docker-compose.yml):**
```yaml
DATABASE_URL: postgresql://quant_user:quant_password_2024@db:5432/quant_tools
WS_URL: wss://api.hyperliquid.xyz/ws
CORS_ORIGINS: http://localhost:3000,http://localhost:8080
```

**Frontend (.env):**
```
VITE_API_URL=http://localhost:8002
```

### Data Collection Settings

**backend/app/websocket_collector.py:**
```python
COIN = "BTC"                    # Trading pair
INTERVAL = "3min"               # Candle interval
SAVE_INTERVAL = 300             # Save to DB every 5 minutes
MAX_TRADES_AGE_SEC = 86400      # Keep 24h of trades in memory
RATIO_STRONG = 1.5              # ±3 signal threshold
RATIO_WEAK = 0.5                # ±1 signal threshold
```

## 📈 Frontend Features

### 🎨 Dual-Tab Interface

**1. Order Flow Tab (CVD Analysis)**
- Multi-panel ECharts: Price/CVD, Volume, Efficiency, Cumulative signals
- Signal markers with v1/v2/v3 algorithm visualization
- Order flow zones (optimal LONG/SHORT levels)
- Sidebar with market data KPIs and directional consensus

**2. Liquidity Density Tab (LOB Heatmap)**
- Candlestick chart with LOB density overlay
- Support/resistance heatmap (green=support, red=resistance)
- Directional liquidity profile chart
- Dynamic price bin control (20-200 USD)

### ⚡ TradingView-Style Interactions

- **Y-Axis Drag**: Vertical zoom
- **Y-Axis Wheel**: Zoom with cursor fixed
- **Chart Drag**: Pan both X and Y axes (1:1 movement)
- **Chart Wheel**: Horizontal zoom with cursor fixed
- **Double-Click Y-Axis**: Reset to auto-scale
- **Bottom Slider**: Horizontal pan/zoom

### 📱 Mobile Responsive

- Hamburger menu with slide-in sidebar drawer
- Compact header with icon-only tabs
- Touch-friendly controls (24px+ targets)
- Full desktop functionality preserved

## 🛠️ Development

### Backend Development

```bash
# Install dependencies locally (optional, for IDE)
cd backend
pip install -r requirements.txt

# Run backend directly (without Docker)
uvicorn app.main:app --reload --port 8000

# Database migrations (if needed)
docker exec -it quant_tools_db psql -U quant_user -d quant_tools
```

### Frontend Development

```bash
# Install dependencies locally
cd frontend
npm install

# Run frontend dev server (hot reload)
npm run dev

# Build for production
npm run build
```

### Docker Commands

```bash
# Rebuild services
docker-compose up -d --build

# Stop services
docker-compose down

# Stop and remove volumes (reset database)
docker-compose down -v

# View logs
docker-compose logs -f [service_name]

# Execute commands in containers
docker exec -it quant_tools_backend bash
docker exec -it quant_tools_db psql -U quant_user -d quant_tools
```

## 📊 Monitoring

### Health Checks

All services include Docker health checks:
- **Database**: `pg_isready` command
- **Backend**: `/health` endpoint
- **Nginx**: HTTP status check

### Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Database Queries

```sql
-- Total candles
SELECT COUNT(*) FROM cvd_candles;

-- Data range
SELECT MIN(timestamp), MAX(timestamp) FROM cvd_candles;

-- Signal distribution
SELECT signal, COUNT(*) FROM cvd_candles GROUP BY signal ORDER BY signal;

-- Recent signals
SELECT timestamp, signal, cumulative_signal FROM cvd_candles
WHERE signal != 0 ORDER BY timestamp DESC LIMIT 20;

-- Statistics view
SELECT * FROM cvd_stats;
```

## 🚢 Production Deployment (Hetzner CX33)

### Prerequisites
- Hetzner VPS (CX33 recommended: 4 vCPU, 8GB RAM, €6.09/month)
- Domain with DNS configured
- SSH access

### Deployment Steps

```bash
# 1. SSH into server
ssh root@your-server-ip

# 2. Install Docker + Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 3. Clone repository
git clone <your-repo-url>
cd quant_tools

# 4. Update docker-compose.yml for production
# - Change ports (remove external port mappings)
# - Update CORS_ORIGINS to your domain
# - Add SSL certificates path

# 5. Start services
docker-compose up -d

# 6. Setup Nginx reverse proxy + SSL (Certbot)
# See nginx/production.conf.example
```

### SSL Setup (Let's Encrypt)

```bash
# Install Certbot
apt-get install certbot python3-certbot-nginx

# Obtain certificate
certbot --nginx -d your-domain.com

# Auto-renewal (already configured)
certbot renew --dry-run
```

## 📝 Project Structure

```
quant_tools/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app
│   │   ├── database.py          # SQLAlchemy models
│   │   ├── cvd_engine.py        # CVD calculation logic
│   │   └── websocket_collector.py  # Hyperliquid WebSocket
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CVDChart.jsx     # ECharts visualization
│   │   │   ├── Header.jsx       # Top bar
│   │   │   └── Sidebar.jsx      # Stats + controls
│   │   ├── App.jsx              # Main app
│   │   ├── main.jsx             # Entry point
│   │   └── index.css            # TailwindCSS
│   ├── Dockerfile.dev
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
├── nginx/
│   └── nginx.conf               # Reverse proxy config
├── database/
│   └── migrations/
│       └── 001_init_schema.sql  # Initial schema
├── docker-compose.yml           # Multi-container setup
└── README.md
```

## 🎯 Current Features

✅ **Real-time CVD Analysis** - 3 signal algorithms (v1/v2/v3) with order flow zones
✅ **LOB Density Heatmap** - Support/resistance visualization with directional profile
✅ **TradingView-Style UX** - Professional chart interactions (drag/zoom/pan)
✅ **Mobile Responsive** - Full-featured mobile interface
✅ **WebSocket Collector** - Real-time data from Hyperliquid
✅ **Optimized Database** - Bulk inserts with TimeSeries indexing
✅ **Production Ready** - Docker multi-container with health checks

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Check if database is running
docker-compose ps db

# Check logs
docker-compose logs db

# Test connection
docker exec -it quant_tools_db psql -U quant_user -d quant_tools -c "SELECT 1"
```

### Backend Not Starting
```bash
# Check logs
docker-compose logs backend

# Common issues:
# - Database not ready: wait for db health check
# - Port conflict: change port in docker-compose.yml
# - Missing environment variables: check docker-compose.yml
```

### Frontend Build Issues
```bash
# Clear node_modules and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install

# Rebuild container
docker-compose up -d --build frontend
```

## 📄 License

MIT License - See LICENSE file

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

## 📧 Contact

- **GitHub**: [@FedeAnastasi](https://github.com/FedeAnastasi)
- **Twitter/X**: [@FedeAnastasi](https://twitter.com/FedeAnastasi)

---

**Tech Stack:** FastAPI • React 19 • Apache ECharts • PostgreSQL • Docker • TailwindCSS • Nginx

**Deployment:** Hetzner VPS (CX33 recommended - €6.09/month)
