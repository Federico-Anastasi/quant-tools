#!/bin/bash

# Import Quant Tools - SOLO dati mancanti (evita sovrapposizioni)
#
# LOCALE: 26 Nov 12:24 → 28 Nov 23:26
# PRODUZIONE: 28 Nov 18:54 → 28 Nov 23:33
#
# IMPORTO: 26 Nov → 28 Nov 18:54 (dati mancanti)

echo "======================================"
echo "QUANT TOOLS - IMPORT DATI STORICI"
echo "======================================"
echo ""

DB_CONTAINER="quant_tools_db"
DB_USER="quant_user"
DB_NAME="quant_tools"
DUMP_FILE="/tmp/quant_tools_export.sql"

# Verifica file
if [ ! -f "$DUMP_FILE" ]; then
    echo "❌ File $DUMP_FILE non trovato!"
    exit 1
fi

echo "📊 Stato ATTUALE produzione:"
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "
SELECT 'cvd_candles' as tabella,
       COUNT(*) as righe,
       MIN(timestamp) as primo,
       MAX(timestamp) as ultimo
FROM cvd_candles
UNION ALL
SELECT 'runs', COUNT(*), MIN(t_start), MAX(t_end) FROM runs;"

echo ""
echo "📥 IMPORTERÒ: Solo dati PRIMA del primo timestamp produzione"
echo "   (evito sovrapposizioni)"
echo ""

# Trova MIN timestamp produzione (non MAX!)
MIN_PROD=$(docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c "SELECT COALESCE(MIN(timestamp), '2099-01-01'::timestamptz) FROM cvd_candles;")
MIN_RUNS_PROD=$(docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c "SELECT COALESCE(MIN(t_start), '2099-01-01'::timestamptz) FROM runs;")

echo "✓ Primo timestamp cvd_candles produzione: $MIN_PROD"
echo "✓ Primo timestamp runs produzione: $MIN_RUNS_PROD"
echo ""
echo "→ Importerò SOLO timestamp < $MIN_PROD"
echo ""

read -p "Confermi? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Annullato."
    exit 0
fi

# Crea temp tables SENZA constraints per evitare conflitti durante l'import
echo "🔄 Creazione tabelle temporanee..."
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME <<'EOF'
DROP TABLE IF EXISTS temp_candles;
DROP TABLE IF EXISTS temp_runs;
CREATE TABLE temp_candles (LIKE cvd_candles INCLUDING DEFAULTS EXCLUDING CONSTRAINTS EXCLUDING INDEXES);
CREATE TABLE temp_runs (LIKE runs INCLUDING DEFAULTS EXCLUDING CONSTRAINTS EXCLUDING INDEXES);
EOF

echo "✓ Temp tables create"
echo ""

# Import dump modificato (INSERT in temp_*)
echo "📥 Import dump in temp tables..."
sed 's/INSERT INTO cvd_candles/INSERT INTO temp_candles/g; s/INSERT INTO runs/INSERT INTO temp_runs/g' $DUMP_FILE | \
  docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME 2>&1 | grep -E "(INSERT|ERROR)" | head -20

echo ""
echo "🔀 Import SOLO dati NON presenti in produzione..."

# Import con filtro timestamp < MIN produzione
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME <<EOF
-- Candele PRIMA del primo timestamp produzione (senza id per evitare conflitti)
INSERT INTO cvd_candles (timestamp, symbol, price_open, price_high, price_low, price_close,
                          cvd_open, cvd_high, cvd_low, cvd_close, volume_buy, volume_sell,
                          efficiency_ratio, signal, signal_quality, cumulative_v1, cumulative_v2,
                          cumulative_v3, cumulative_v3_ema, finalized, created_at, updated_at)
SELECT timestamp, symbol, price_open, price_high, price_low, price_close,
       cvd_open, cvd_high, cvd_low, cvd_close, volume_buy, volume_sell,
       efficiency_ratio, signal, signal_quality, cumulative_v1, cumulative_v2,
       cumulative_v3, cumulative_v3_ema, finalized, created_at, updated_at
FROM temp_candles
WHERE timestamp < '$MIN_PROD'::timestamptz;

-- Runs PRIMA del primo timestamp produzione (senza id)
INSERT INTO runs (symbol, t_start, t_end, price_start, price_end, price_mid, dir,
                  delta_p, Q, q, V_eff, velocity, duration, n_ticks, created_at)
SELECT symbol, t_start, t_end, price_start, price_end, price_mid, dir,
       delta_p, Q, q, V_eff, velocity, duration, n_ticks, created_at
FROM temp_runs
WHERE t_start < '$MIN_RUNS_PROD'::timestamptz;

-- Report
SELECT COUNT(*) || ' candele storiche importate' as result
FROM temp_candles
WHERE timestamp < '$MIN_PROD'::timestamptz;

SELECT COUNT(*) || ' runs storici importati' as result
FROM temp_runs
WHERE t_start < '$MIN_RUNS_PROD'::timestamptz;
EOF

echo ""
echo "🧹 Pulizia..."
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "DROP TABLE temp_candles, temp_runs;"

echo ""
echo "📊 Stato FINALE produzione:"
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "
SELECT 'cvd_candles' as tabella,
       COUNT(*) as righe,
       MIN(timestamp) as primo,
       MAX(timestamp) as ultimo
FROM cvd_candles
UNION ALL
SELECT 'runs', COUNT(*), MIN(t_start), MAX(t_end) FROM runs;"

echo ""
echo "✅ COMPLETATO!"
echo ""
echo "Dovresti vedere:"
echo "  - cvd_candles: ~1,200 righe (26 Nov → 28 Nov 23:33)"
echo "  - runs: ~96,000 righe (26 Nov → 28 Nov 23:33)"
