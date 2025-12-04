# Testing Multi-Container Architecture - Local Environment

## Summary of Changes

### New Files Created
1. **`backend/app/redis_service.py`** - Redis integration layer (LOB cache, pub/sub, locks)
2. **`backend/app/lob_subscriber.py`** - LOB calculation subscriber (Compute Container)
3. **`backend/app/main_realtime.py`** - Real-Time Container entry point
4. **`backend/app/main_compute.py`** - Compute Container entry point
5. **`docker-compose.multicontainer.yml`** - Multi-container configuration for testing

### Modified Files
1. **`backend/app/lob_cache.py`** - Redis-backed cache (replaced in-memory dict)
2. **`backend/app/cvd_pipeline.py`** (lines 139-144) - Publish LOB trigger to Redis
3. **`backend/app/bot_executor.py`** (lines 583-634) - Redis lock for singleton enforcement
4. **`backend/app/main.py`** (lines 166-202) - Support for CONTAINER_MODE environment variable
5. **`backend/app/database.py`** (lines 34-42) - Reduced connection pool for 4 containers
6. **`backend/requirements.txt`** - Added `redis>=5.0.1`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ API Container (1 CPU)                                            │
│ - FastAPI endpoints only                                         │
│ - Reads LOB cache from Redis                                     │
│ - No background tasks                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (reads database)
┌─────────────────────────────────────────────────────────────────┐
│ Real-Time Container (1 CPU, SINGLETON)                           │
│ - WebSocket Collector (trades from Hyperliquid)                 │
│ - CVD Pipeline (3-min candles, publishes LOB trigger to Redis)  │
│ - Runs Pipeline (directional runs)                              │
│ - Bot Executor (paper trading, Redis lock for singleton)        │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (Redis Pub/Sub)
┌─────────────────────────────────────────────────────────────────┐
│ Compute Container (1 CPU)                                        │
│ - LOB Subscriber (listens to Redis, calculates LOB density)     │
│ - Zone Pipeline (hourly Triple Barrier analysis)                │
│ - Writes LOB cache to Redis                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↕ (shared state)
┌─────────────────────────────────────────────────────────────────┐
│ Redis Container                                                  │
│ - LOB cache (Compute writes, API reads)                         │
│ - Pub/Sub (Real-Time → Compute triggers)                        │
│ - Bot executor lock (singleton enforcement)                     │
└─────────────────────────────────────────────────────────────────┘
                              ↕ (database)
┌─────────────────────────────────────────────────────────────────┐
│ PostgreSQL Container (1 CPU)                                    │
│ - max_connections = 200 (4 containers × 25 connections)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Testing Steps

### 1. Build and Start Containers

```bash
cd c:/Users/Mango/Desktop/Dev_FA/mangolabs/papers/quant_tools

# Stop old monolithic container (if running)
docker-compose down

# Build and start new multi-container architecture
docker-compose -f docker-compose.multicontainer.yml build
docker-compose -f docker-compose.multicontainer.yml up -d
```

### 2. Verify All Containers Running

```bash
docker ps
```

**Expected output**: 7 containers running
- `quant_tools_db`
- `quant_tools_redis`
- `quant_tools_api`
- `quant_tools_realtime`
- `quant_tools_compute`
- `quant_tools_frontend`
- `quant_tools_nginx`

### 3. Check Container Logs

#### API Container
```bash
docker logs quant_tools_api --tail 50
```
**Expected**:
- `[API MODE] HTTP endpoints only - background pipelines disabled`
- No WebSocket/CVD/Bot logs

#### Real-Time Container
```bash
docker logs quant_tools_realtime --tail 100 -f
```
**Expected** (within 3 minutes):
- `[REAL-TIME CONTAINER] Starting all real-time pipelines...`
- `[WS] Connected to Hyperliquid - BTC`
- `[CVD] In-progress candle ...`
- `[RUNS] Saved X closed runs`
- `[BOT EXECUTOR] Lock acquired (container_id=...)`
- `[CVD] Finalized candle ... | signal=...`
- `[CVD] Triggered LOB calculation via Redis for candle ...`

#### Compute Container
```bash
docker logs quant_tools_compute --tail 100 -f
```
**Expected** (after first candle finalized):
- `[COMPUTE CONTAINER] Starting CPU-intensive pipelines...`
- `[LOB SUBSCRIBER] Starting LOB calculation subscriber...`
- `[LOB SUBSCRIBER] [1] Received trigger for BTC at ...`
- `[LOB CACHE] Updated BTC | bins=238 | runs=...`
- `[LOB SUBSCRIBER] [1] Completed LOB calculation for BTC`

### 4. Verify Redis Communication

```bash
# Connect to Redis CLI
docker exec -it quant_tools_redis redis-cli

# Check LOB cache exists (after 3 minutes)
KEYS lob_cache:*

# Expected output:
# 1) "lob_cache:BTC:720:50"

# Check bot executor lock
GET bot_executor_lock

# Expected output:
# "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" (UUID)

# Subscribe to LOB trigger channel (test pub/sub)
SUBSCRIBE lob_trigger_channel

# Wait for next candle finalization (3 minutes)
# Expected output:
# 1) "message"
# 2) "lob_trigger_channel"
# 3) "{\"symbol\":\"BTC\",\"timestamp\":\"2025-12-04T...\"}"
```

### 5. Test API Endpoints

```bash
# Health check
curl http://localhost:8000/health

# LOB density (should read from Redis cache)
curl http://localhost:8000/api/lob-density

# Expected: Response in <100ms (cache hit)

# Bots list
curl http://localhost:8000/api/bots
```

### 6. Test Singleton Bot Executor

**Test**: Start a second Real-Time container (should fail to acquire lock)

```bash
# Start duplicate container (temporary test)
docker run --rm --network quant_network \
  -e DATABASE_URL=postgresql://quant_user:quant_password_2024@db:5432/quant_tools \
  -e REDIS_URL=redis://redis:6379/0 \
  -e WS_URL=wss://api.hyperliquid.xyz/ws \
  quant_tools_realtime python -m app.main_realtime
```

**Expected logs**:
```
[BOT EXECUTOR] Another instance is already running. Exiting.
```

Bot executor should NOT start (lock held by first container).

### 7. Monitor CPU Usage

```bash
docker stats

# Expected CPU distribution:
# quant_tools_db         ~25% (1 CPU reserved, not limited)
# quant_tools_api        ~10% (idle, waiting for requests)
# quant_tools_realtime   ~30% (WebSocket + CVD + Runs + Bot)
# quant_tools_compute    ~15% (LOB every 3min, Zone every 1h)
# quant_tools_redis      ~2%  (minimal)
# quant_tools_nginx      ~1%  (minimal)
# quant_tools_frontend   ~1%  (static files)
```

### 8. Verify Database Connections

```bash
docker exec quant_tools_db psql -U quant_user -d quant_tools -c \
  "SELECT count(*) as active_connections, max_connections
   FROM pg_stat_activity,
        (SELECT setting::int as max_connections FROM pg_settings WHERE name='max_connections') s
   GROUP BY max_connections;"
```

**Expected**:
```
 active_connections | max_connections
--------------------+-----------------
                 45 |             200
```

Should be **< 150** (safe margin for 4 containers × 25 max)

---

## Validation Checklist

- [ ] 7 containers running (`docker ps`)
- [ ] API container shows `[API MODE]` in logs
- [ ] Real-Time container shows all 4 pipelines started
- [ ] Compute container receives LOB trigger from Redis
- [ ] Redis has `lob_cache:BTC:720:50` key after 3 minutes
- [ ] Redis has `bot_executor_lock` key with UUID value
- [ ] Bot executor prevents duplicate instances
- [ ] API `/api/lob-density` responds in <100ms (Redis cache)
- [ ] Database connections < 150 (safe for 4 containers)
- [ ] CPU usage distributed across containers (~25% each for reserved)

---

## Troubleshooting

### Issue: API returns empty LOB data
**Solution**: Wait 3 minutes for first candle finalization, then check Redis:
```bash
docker exec quant_tools_redis redis-cli KEYS "lob_cache:*"
```

### Issue: Bot executor lock not found
**Solution**: Check Real-Time container logs for lock acquisition:
```bash
docker logs quant_tools_realtime | grep "Lock acquired"
```

### Issue: LOB subscriber not receiving triggers
**Solution**: Check Redis pub/sub:
```bash
docker exec quant_tools_redis redis-cli PUBSUB CHANNELS
# Expected: lob_trigger_channel
```

### Issue: Database connection errors
**Solution**: Verify max_connections:
```bash
docker exec quant_tools_db psql -U quant_user -d quant_tools \
  -c "SHOW max_connections;"
# Expected: 200
```

---

## Performance Expectations

| Metric | Expected Value | How to Verify |
|--------|----------------|---------------|
| LOB cache hit rate | >95% | Check Redis `INFO stats` |
| API response time | <100ms | `curl -w "@-" http://localhost:8000/api/lob-density` |
| Database connections | <150 | Query `pg_stat_activity` |
| CPU per container | ~25% (reserved) | `docker stats` |
| LOB calculation time | 5-20s | Compute container logs |
| Zone analysis time | <5min | Compute container logs (hourly) |

---

## Next Steps (After Local Testing)

1. **Verify all tests pass** (see checklist above)
2. **Run stress test** (20 concurrent users)
3. **Monitor for 1 hour** (ensure no memory leaks, errors)
4. **Commit changes** to GitHub
5. **Deploy to production** (psiquant.xyz)

---

## Rollback (if needed)

```bash
# Stop multi-container setup
docker-compose -f docker-compose.multicontainer.yml down

# Restart old monolithic setup
docker-compose up -d
```

This will revert to the previous monolithic architecture (all pipelines in single backend container).
