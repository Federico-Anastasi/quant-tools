#!/usr/bin/env python3
"""
Import historical data from SQL dump with timestamp filtering.
Avoids duplicates by filtering records before MIN(production timestamp).
"""

import re
import sys
from datetime import datetime
import psycopg2
from psycopg2.extras import execute_values

# Database connection
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'quant_tools',
    'user': 'quant_user',
    'password': 'quant_password'  # Change this!
}

def get_min_timestamps(conn):
    """Get minimum timestamps from production database."""
    with conn.cursor() as cur:
        cur.execute("SELECT COALESCE(MIN(timestamp), '2099-01-01'::timestamptz) FROM cvd_candles;")
        min_candle = cur.fetchone()[0]

        cur.execute("SELECT COALESCE(MIN(t_start), '2099-01-01'::timestamptz) FROM runs;")
        min_run = cur.fetchone()[0]

    return min_candle, min_run

def parse_insert_statement(line, table_name):
    """
    Parse PostgreSQL INSERT statement and extract values.
    Returns list of tuples ready for insertion.
    """
    # Match: INSERT INTO table_name VALUES (...)
    pattern = rf"INSERT INTO {table_name} VALUES (.+);"
    match = re.search(pattern, line)

    if not match:
        return []

    values_str = match.group(1)

    # Split by "),(" to get individual rows
    rows = []
    for row_match in re.finditer(r'\(([^)]+)\)', values_str):
        values = row_match.group(1)
        # Simple CSV parsing (works for PostgreSQL dumps)
        row = []
        for val in values.split(','):
            val = val.strip()
            if val == 'NULL':
                row.append(None)
            elif val.startswith("'"):
                row.append(val.strip("'"))
            else:
                row.append(val)
        rows.append(tuple(row))

    return rows

def import_candles(conn, dump_file, min_timestamp):
    """Import cvd_candles with timestamp filtering."""
    inserted = 0

    with conn.cursor() as cur:
        with open(dump_file, 'r') as f:
            batch = []

            for line in f:
                if not line.startswith('INSERT INTO cvd_candles'):
                    continue

                rows = parse_insert_statement(line, 'cvd_candles')

                for row in rows:
                    # row[0] = id, row[1] = timestamp
                    timestamp = row[1]

                    # Skip if timestamp >= min_production
                    if timestamp >= str(min_timestamp):
                        continue

                    # Exclude id (row[0]), keep rest
                    data = row[1:]
                    batch.append(data)

                    if len(batch) >= 100:
                        execute_values(
                            cur,
                            """INSERT INTO cvd_candles (
                                timestamp, symbol, price_open, price_high, price_low, price_close,
                                cvd_open, cvd_high, cvd_low, cvd_close, volume_buy, volume_sell,
                                efficiency_ratio, signal, signal_quality, cumulative_v1, cumulative_v2,
                                cumulative_v3, cumulative_v3_ema, finalized, created_at, updated_at
                            ) VALUES %s""",
                            batch
                        )
                        inserted += len(batch)
                        batch = []
                        conn.commit()

            # Insert remaining
            if batch:
                execute_values(
                    cur,
                    """INSERT INTO cvd_candles (
                        timestamp, symbol, price_open, price_high, price_low, price_close,
                        cvd_open, cvd_high, cvd_low, cvd_close, volume_buy, volume_sell,
                        efficiency_ratio, signal, signal_quality, cumulative_v1, cumulative_v2,
                        cumulative_v3, cumulative_v3_ema, finalized, created_at, updated_at
                    ) VALUES %s""",
                    batch
                )
                inserted += len(batch)
                conn.commit()

    return inserted

def import_runs(conn, dump_file, min_timestamp):
    """Import runs with timestamp filtering."""
    inserted = 0

    with conn.cursor() as cur:
        with open(dump_file, 'r') as f:
            batch = []

            for line in f:
                if not line.startswith('INSERT INTO runs'):
                    continue

                rows = parse_insert_statement(line, 'runs')

                for row in rows:
                    # row[0] = id, row[2] = t_start
                    t_start = row[2]

                    # Skip if t_start >= min_production
                    if t_start >= str(min_timestamp):
                        continue

                    # Exclude id (row[0]), keep rest
                    data = row[1:]
                    batch.append(data)

                    if len(batch) >= 500:
                        execute_values(
                            cur,
                            """INSERT INTO runs (
                                symbol, t_start, t_end, price_start, price_end, price_mid, dir,
                                delta_p, Q, q, V_eff, velocity, duration, n_ticks, created_at
                            ) VALUES %s""",
                            batch
                        )
                        inserted += len(batch)
                        batch = []
                        conn.commit()

            # Insert remaining
            if batch:
                execute_values(
                    cur,
                    """INSERT INTO runs (
                        symbol, t_start, t_end, price_start, price_end, price_mid, dir,
                        delta_p, Q, q, V_eff, velocity, duration, n_ticks, created_at
                    ) VALUES %s""",
                    batch
                )
                inserted += len(batch)
                conn.commit()

    return inserted

def main():
    if len(sys.argv) < 2:
        print("Usage: python import_data.py <dump_file.sql>")
        sys.exit(1)

    dump_file = sys.argv[1]

    print("=" * 50)
    print("QUANT TOOLS - IMPORT DATI STORICI (Python)")
    print("=" * 50)
    print()

    # Connect
    print("📡 Connessione al database...")
    conn = psycopg2.connect(**DB_CONFIG)

    # Get min timestamps
    print("🔍 Recupero timestamp minimo produzione...")
    min_candle, min_run = get_min_timestamps(conn)
    print(f"✓ Min cvd_candles: {min_candle}")
    print(f"✓ Min runs: {min_run}")
    print()

    # Confirm
    response = input("Vuoi procedere? (y/n) ")
    if response.lower() != 'y':
        print("Annullato.")
        return

    # Import candles
    print("📥 Import cvd_candles...")
    candles_count = import_candles(conn, dump_file, min_candle)
    print(f"✓ {candles_count} candele importate")

    # Import runs
    print("📥 Import runs...")
    runs_count = import_runs(conn, dump_file, min_run)
    print(f"✓ {runs_count} runs importati")

    # Final stats
    print()
    print("📊 Stato finale:")
    with conn.cursor() as cur:
        cur.execute("""
            SELECT 'cvd_candles' as tabella, COUNT(*) as righe,
                   MIN(timestamp) as primo, MAX(timestamp) as ultimo
            FROM cvd_candles
            UNION ALL
            SELECT 'runs', COUNT(*), MIN(t_start), MAX(t_end) FROM runs
        """)
        for row in cur.fetchall():
            print(f"  {row[0]}: {row[1]} righe ({row[2]} → {row[3]})")

    conn.close()
    print()
    print("✅ COMPLETATO!")

if __name__ == '__main__':
    main()
