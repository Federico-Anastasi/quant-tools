#!/bin/bash

# Import con filtro timestamp usando solo PostgreSQL (no Python)
# Strategia: crea DB temporaneo, importa tutto lì, poi copia solo i dati filtrati

DUMP_FILE="$1"
DB_CONTAINER="quant_tools_db"
DB_USER="quant_user"
TEMP_DB="quant_tools_temp"
PROD_DB="quant_tools"

if [ -z "$DUMP_FILE" ]; then
    echo "Usage: ./import_filtered.sh <dump_file.sql>"
    exit 1
fi

if [ ! -f "$DUMP_FILE" ]; then
    echo "❌ File $DUMP_FILE non trovato!"
    exit 1
fi

echo "======================================"
echo "QUANT TOOLS - IMPORT FILTRATO"
echo "======================================"
echo ""

# 1. Trova MIN timestamp in produzione
echo "🔍 Recupero timestamp minimo produzione..."
MIN_CANDLE=$(docker exec $DB_CONTAINER psql -U $DB_USER -d $PROD_DB -t -c "SELECT COALESCE(MIN(timestamp), '2099-01-01'::timestamptz) FROM cvd_candles;")
MIN_RUN=$(docker exec $DB_CONTAINER psql -U $DB_USER -d $PROD_DB -t -c "SELECT COALESCE(MIN(t_start), '2099-01-01'::timestamptz) FROM runs;")

echo "✓ Min cvd_candles: $MIN_CANDLE"
echo "✓ Min runs: $MIN_RUN"
echo ""

# 2. Mostra stato attuale
echo "📊 Stato PRIMA import:"
docker exec $DB_CONTAINER psql -U $DB_USER -d $PROD_DB -c "
SELECT 'cvd_candles' as tabella, COUNT(*) FROM cvd_candles
UNION ALL
SELECT 'runs', COUNT(*) FROM runs;"
echo ""

read -p "Confermi import? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Annullato."
    exit 0
fi

# 3. Crea database temporaneo
echo "🔄 Creazione database temporaneo..."
docker exec $DB_CONTAINER psql -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS $TEMP_DB;"
docker exec $DB_CONTAINER psql -U $DB_USER -d postgres -c "CREATE DATABASE $TEMP_DB OWNER $DB_USER;"

# 4. Importa dump nel DB temporaneo
echo "📥 Import dump in database temporaneo..."
docker cp "$DUMP_FILE" $DB_CONTAINER:/tmp/dump.sql
docker exec $DB_CONTAINER psql -U $DB_USER -d $TEMP_DB -f /tmp/dump.sql > /dev/null 2>&1

# 5. Copia SOLO dati filtrati da temp a produzione
echo "🔀 Copia dati filtrati in produzione..."
docker exec $DB_CONTAINER psql -U $DB_USER -d $PROD_DB <<EOF
-- Import cvd_candles filtrate
INSERT INTO cvd_candles (
    timestamp, symbol, price_open, price_high, price_low, price_close,
    cvd_open, cvd_high, cvd_low, cvd_close, volume_buy, volume_sell,
    efficiency_ratio, signal, signal_quality, cumulative_v1, cumulative_v2,
    cumulative_v3, cumulative_v3_ema, finalized, created_at, updated_at
)
SELECT timestamp, symbol, price_open, price_high, price_low, price_close,
       cvd_open, cvd_high, cvd_low, cvd_close, volume_buy, volume_sell,
       efficiency_ratio, signal, signal_quality, cumulative_v1, cumulative_v2,
       cumulative_v3, cumulative_v3_ema, finalized, created_at, updated_at
FROM dblink('dbname=$TEMP_DB user=$DB_USER', 'SELECT timestamp, symbol, price_open, price_high, price_low, price_close, cvd_open, cvd_high, cvd_low, cvd_close, volume_buy, volume_sell, efficiency_ratio, signal, signal_quality, cumulative_v1, cumulative_v2, cumulative_v3, cumulative_v3_ema, finalized, created_at, updated_at FROM cvd_candles WHERE timestamp < ''$MIN_CANDLE''::timestamptz')
AS t(timestamp timestamptz, symbol varchar, price_open numeric, price_high numeric, price_low numeric, price_close numeric, cvd_open numeric, cvd_high numeric, cvd_low numeric, cvd_close numeric, volume_buy numeric, volume_sell numeric, efficiency_ratio numeric, signal smallint, signal_quality numeric, cumulative_v1 numeric, cumulative_v2 numeric, cumulative_v3 numeric, cumulative_v3_ema numeric, finalized boolean, created_at timestamptz, updated_at timestamptz);

SELECT COUNT(*) || ' candele importate' FROM cvd_candles WHERE timestamp < '$MIN_CANDLE'::timestamptz;

-- Import runs filtrati
INSERT INTO runs (
    symbol, t_start, t_end, price_start, price_end, price_mid, dir,
    delta_p, Q, q, V_eff, velocity, duration, n_ticks, created_at
)
SELECT symbol, t_start, t_end, price_start, price_end, price_mid, dir,
       delta_p, Q, q, V_eff, velocity, duration, n_ticks, created_at
FROM dblink('dbname=$TEMP_DB user=$DB_USER', 'SELECT symbol, t_start, t_end, price_start, price_end, price_mid, dir, delta_p, Q, q, V_eff, velocity, duration, n_ticks, created_at FROM runs WHERE t_start < ''$MIN_RUN''::timestamptz')
AS t(symbol varchar, t_start timestamptz, t_end timestamptz, price_start numeric, price_end numeric, price_mid numeric, dir varchar, delta_p numeric, Q numeric, q numeric, V_eff numeric, velocity numeric, duration numeric, n_ticks integer, created_at timestamptz);

SELECT COUNT(*) || ' runs importati' FROM runs WHERE t_start < '$MIN_RUN'::timestamptz;
EOF

# 6. Cleanup
echo ""
echo "🧹 Pulizia..."
docker exec $DB_CONTAINER psql -U $DB_USER -d postgres -c "DROP DATABASE $TEMP_DB;"
docker exec $DB_CONTAINER rm -f /tmp/dump.sql

# 7. Stato finale
echo ""
echo "📊 Stato DOPO import:"
docker exec $DB_CONTAINER psql -U $DB_USER -d $PROD_DB -c "
SELECT 'cvd_candles' as tabella,
       COUNT(*) as righe,
       MIN(timestamp) as primo,
       MAX(timestamp) as ultimo
FROM cvd_candles
UNION ALL
SELECT 'runs', COUNT(*), MIN(t_start), MAX(t_end) FROM runs;"

echo ""
echo "✅ COMPLETATO!"
