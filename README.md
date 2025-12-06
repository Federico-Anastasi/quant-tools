# PsiQuant - Order Flow Analytics

Open-source market microstructure tools for crypto traders. Real-time CVD tracking, liquidity heatmaps, and trading insights.

🌐 **[Live Demo](https://psiquant.xyz)** | 📊 **Free Research Platform**

---

## Overview

PsiQuant provides professional-grade order flow analysis tools for cryptocurrency markets. Built with transparency and accessibility in mind, all code is open-source and the platform is free to use.

### Key Features

- **Real-time CVD Analysis** - Cumulative Volume Delta tracking with multi-algorithm signal generation
- **Liquidity Density Heatmaps** - Support/resistance visualization from limit order book data
- **TradingView-Style UX** - Professional chart interactions with drag, zoom, and pan
- **Mobile Responsive** - Full-featured interface optimized for desktop and mobile
- **WebSocket Data Streams** - Real-time market data collection and processing
- **Open Source** - Transparent codebase available for audit and contribution

---

## Technology Stack

**Backend:**
- FastAPI (Python 3.11+)
- PostgreSQL with TimescaleDB
- Redis (caching + pub/sub)
- WebSocket collectors (Hyperliquid API)

**Frontend:**
- React 19
- Apache ECharts (visualization)
- TailwindCSS (styling)
- Vite (build tool)

**Infrastructure:**
- Docker + Docker Compose
- Nginx (reverse proxy + SSL)
- Let's Encrypt (SSL certificates)

---

## Quick Start (Local Development)

### Prerequisites

- Docker + Docker Compose V2
- Git

### Setup

```bash
# Clone repository
git clone https://github.com/Federico-Anastasi/quant-tools.git
cd quant-tools

# Start all services
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

### Access Points

- **Application**: http://localhost:8082
- **API Documentation**: http://localhost:8002/docs
- **Health Check**: http://localhost:8002/health

### Stop Services

```bash
docker compose down

# Stop and remove all data
docker compose down -v
```

---

## API Endpoints

All endpoints are documented in the interactive Swagger UI at `/docs` when running locally.

### Public Endpoints

```bash
# Get CVD candles
GET /api/candles?hours=24&limit=1000

# Get order flow zones
GET /api/order-flow-zones?symbol=BTC

# Get LOB density heatmap
GET /api/lob-density?symbol=BTC&hours=720

# Get statistics
GET /api/stats

# Health check
GET /health
```

---

## Architecture

```
┌─────────────┐
│   Nginx     │  ← Reverse proxy + SSL termination
└──────┬──────┘
       │
   ┌───┴────┐
   │        │
┌──▼──┐  ┌─▼────┐
│ API │  │ Web  │
└──┬──┘  └──────┘
   │
┌──▼──────────┐
│ PostgreSQL  │  ← TimeSeries data storage
└─────────────┘
┌─────────────┐
│   Redis     │  ← Caching + real-time coordination
└─────────────┘
```

**Multi-container setup:**
- `db` - PostgreSQL with TimescaleDB extension
- `redis` - Cache and pub/sub message broker
- `api` - FastAPI backend (REST endpoints)
- `realtime` - WebSocket data collector
- `compute` - Background computation tasks
- `frontend` - React application (static build)
- `nginx` - Reverse proxy with SSL

---

## Development

### Backend Development

```bash
# Install dependencies
cd backend
pip install -r requirements.txt

# Run locally (without Docker)
uvicorn app.main:app --reload --port 8000
```

### Frontend Development

```bash
# Install dependencies
cd frontend
npm install

# Run dev server with hot reload
npm run dev

# Build for production
npm run build
```

### Docker Commands

```bash
# Rebuild specific service
docker compose up -d --build frontend

# View logs for specific service
docker compose logs -f api

# Execute commands in containers
docker compose exec api bash
docker compose exec db psql -U quant_user -d quant_tools
```

---

## Project Structure

```
quant_tools/
├── backend/               # FastAPI application
│   ├── app/
│   │   ├── main.py       # API routes and app config
│   │   ├── database.py   # Database models and connection
│   │   ├── cvd_engine.py # CVD calculation logic
│   │   └── websocket_collector.py  # Real-time data collection
│   └── requirements.txt
├── frontend/              # React application
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── App.jsx       # Main application
│   │   └── main.jsx      # Entry point
│   └── package.json
├── nginx/                 # Nginx configuration
│   ├── nginx.conf        # Development config
│   └── nginx.prod.conf   # Production config
├── database/
│   └── migrations/       # Database schema migrations
├── docker-compose.yml     # Development setup
├── docker-compose.prod.yml # Production setup
└── README.md
```

---

## Features Deep Dive

### Order Flow Analysis

**CVD (Cumulative Volume Delta):**
- Tracks the cumulative difference between buy and sell volume
- Multi-algorithm signal generation (v1/v2/v3)
- Order flow zones identify optimal entry/exit levels
- Efficiency ratio calculation (price movement vs CVD)

**Signal Classification:**
- +3: Very strong bullish divergence
- +2: Strong bullish
- +1: Weak bullish
- 0: Neutral
- -1: Weak bearish
- -2: Strong bearish
- -3: Very strong bearish divergence

### Liquidity Density Heatmap

**LOB (Limit Order Book) Analysis:**
- Real-time limit order book snapshots
- Density-based support/resistance identification
- Directional liquidity profile charts
- Dynamic price bin control for granularity

### Chart Interactions

**TradingView-Style Controls:**
- Y-Axis drag: Vertical zoom
- Y-Axis scroll: Zoom with cursor fixed
- Chart drag: Pan both axes
- Chart scroll: Horizontal zoom
- Double-click Y-axis: Reset auto-scale
- Bottom slider: Quick navigation

---

## Contributing

Contributions are welcome! Please feel free to:

1. **Report Issues** - Bug reports and feature requests via GitHub Issues
2. **Submit PRs** - Code improvements and new features
3. **Improve Docs** - Help make documentation clearer
4. **Share Feedback** - Suggestions for UX/feature improvements

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License - See [LICENSE](LICENSE) file for details.

This project is provided as-is for research and educational purposes. No guarantees are made about data accuracy or trading recommendations.

---

## Contact & Community

- **Live Platform**: [psiquant.xyz](https://psiquant.xyz)
- **GitHub**: [@Federico-Anastasi](https://github.com/Federico-Anastasi)
- **Twitter/X**: [@FedeAnastasi](https://twitter.com/FedeAnastasi)

---

## Disclaimer

**Educational & Research Use Only**

This platform is designed for:
- Learning market microstructure concepts
- Research and backtesting trading ideas
- Understanding order flow dynamics

**Not Financial Advice:**
- No trading recommendations are provided
- Past performance does not indicate future results
- Always conduct your own research (DYOR)
- Never trade with funds you cannot afford to lose

---

**Built with ❤️ for the crypto trading community**
