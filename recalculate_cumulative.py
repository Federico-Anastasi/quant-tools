#!/usr/bin/env python3
"""
Raccorda i dati production con lo storico importato.
Shifta i valori delle candele production di un offset pari agli ultimi valori storici.
"""

import os
import sys
from sqlalchemy import create_engine, text

# Database connection - use SQLAlchemy like backend does
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # Fallback for local development
    DATABASE_URL = "postgresql://quant_user:quant_password_2024@quant_tools_db:5432/quant_tools"

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# Timestamp di giunzione tra storico e production
JUNCTION_TIMESTAMP = '2025-11-28 18:54:00+00'

def reconnect_data():
    """Raccorda dati production con storico"""

    with engine.connect() as conn:
        # Step 1: Trova l'ultima candela storica (prima della giunzione)
        print("📊 Recupero ultima candela storica...")
        result = conn.execute(text("""
            SELECT cvd_close, cumulative_v1, cumulative_v2, cumulative_v3_ema
            FROM cvd_candles
            WHERE timestamp < :junction
            ORDER BY timestamp DESC
            LIMIT 1
        """), {"junction": JUNCTION_TIMESTAMP})

        last_historical = result.fetchone()

        if not last_historical:
            print("❌ Nessuna candela storica trovata")
            return

        offset_cvd = float(last_historical[0]) if last_historical[0] else 0.0
        offset_v1 = float(last_historical[1]) if last_historical[1] else 0.0
        offset_v2 = float(last_historical[2]) if last_historical[2] else 0.0
        offset_v3_ema = float(last_historical[3]) if last_historical[3] else 0.0

        print(f"✓ Offset storico:")
        print(f"  CVD: {offset_cvd:.2f}")
        print(f"  V1: {offset_v1:.2f}")
        print(f"  V2: {offset_v2:.2f}")
        print(f"  V3_EMA: {offset_v3_ema:.2f}")
        print()

        # Step 2: Leggi tutte le candele production (dalla giunzione in poi)
        print("📥 Caricamento candele production...")
        result = conn.execute(text("""
            SELECT id, timestamp,
                   cvd_open, cvd_high, cvd_low, cvd_close,
                   cumulative_v1, cumulative_v2, cumulative_v3, cumulative_v3_ema,
                   signal, efficiency_ratio, volume_buy, volume_sell
            FROM cvd_candles
            WHERE timestamp >= :junction
            ORDER BY timestamp ASC
        """), {"junction": JUNCTION_TIMESTAMP})

        production_candles = result.fetchall()
        print(f"✓ Trovate {len(production_candles)} candele production da raccordare")
        print()

        if not production_candles:
            print("ℹ️  Nessuna candela production da aggiornare")
            return

        # Step 3: Ricalcola con continuità
        print("🔧 Ricalcolo con raccordo...")

        # Inizializza con offset storico
        cumulative_v1 = offset_v1
        cumulative_v2 = offset_v2
        cumulative_v3_ema = offset_v3_ema
        cvd_cumulative = offset_cvd

        DECAY = 0.95
        EMA_ALPHA = 2.0 / 15.0  # period=14, alpha=2/(14+1)

        for row in production_candles:
            candle_id = row[0]
            signal = row[10] if row[10] is not None else 0
            efficiency_ratio = float(row[11]) if row[11] is not None else 0.0
            volume_buy = float(row[12]) if row[12] is not None else 0.0
            volume_sell = float(row[13]) if row[13] is not None else 0.0

            # Calcola delta per questa candela
            delta_volume = volume_buy - volume_sell

            # CVD: aggiungi delta al cumulativo
            cvd_open_new = cvd_cumulative
            cvd_cumulative += delta_volume
            cvd_close_new = cvd_cumulative
            cvd_high_new = max(cvd_open_new, cvd_close_new)
            cvd_low_new = min(cvd_open_new, cvd_close_new)

            # Cumulative V1: somma semplice
            cumulative_v1 += signal

            # Cumulative V2: weighted con decay (backend formula)
            eff_factor = 1.0 + max(min((efficiency_ratio - 0.5) * 0.5, 0.25), -0.25)
            signal_quality = signal * eff_factor
            cumulative_v2 = cumulative_v2 * DECAY + signal_quality

            # Cumulative V3 EMA: EMA di V1
            cumulative_v3_ema = EMA_ALPHA * cumulative_v1 + (1 - EMA_ALPHA) * cumulative_v3_ema

            # Cumulative V3: momentum (V1 - EMA)
            cumulative_v3 = cumulative_v1 - cumulative_v3_ema

            # Update singola candela
            conn.execute(text("""
                UPDATE cvd_candles
                SET cvd_open = :cvd_open,
                    cvd_high = :cvd_high,
                    cvd_low = :cvd_low,
                    cvd_close = :cvd_close,
                    cumulative_v1 = :cumulative_v1,
                    cumulative_v2 = :cumulative_v2,
                    cumulative_v3 = :cumulative_v3,
                    cumulative_v3_ema = :cumulative_v3_ema
                WHERE id = :id
            """), {
                "cvd_open": round(cvd_open_new, 2),
                "cvd_high": round(cvd_high_new, 2),
                "cvd_low": round(cvd_low_new, 2),
                "cvd_close": round(cvd_close_new, 2),
                "cumulative_v1": round(cumulative_v1, 2),
                "cumulative_v2": round(cumulative_v2, 2),
                "cumulative_v3": round(cumulative_v3, 2),
                "cumulative_v3_ema": round(cumulative_v3_ema, 2),
                "id": candle_id
            })

        conn.commit()
        print(f"✅ Aggiornate {len(production_candles)} candele production")
        print()

        # Step 5: Verifica finale
        result = conn.execute(text("""
            SELECT
                MIN(cvd_close) as min_cvd, MAX(cvd_close) as max_cvd,
                MIN(cumulative_v1) as min_v1, MAX(cumulative_v1) as max_v1,
                MIN(cumulative_v2) as min_v2, MAX(cumulative_v2) as max_v2,
                MIN(cumulative_v3) as min_v3, MAX(cumulative_v3) as max_v3
            FROM cvd_candles
        """))
        stats = result.fetchone()
        print(f"📈 Range finali (storico + production):")
        print(f"  CVD: {stats[0]:.2f} → {stats[1]:.2f}")
        print(f"  V1: {stats[2]:.2f} → {stats[3]:.2f}")
        print(f"  V2: {stats[4]:.2f} → {stats[5]:.2f}")
        print(f"  V3: {stats[6]:.2f} → {stats[7]:.2f}")


def main():
    print("=" * 50)
    print("RACCORDO DATI STORICO + PRODUCTION")
    print("=" * 50)
    print()

    print("📡 Connessione al database...")
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print(f"✓ Connesso")
    except Exception as e:
        print(f"❌ Errore: {e}")
        sys.exit(1)

    print()
    print(f"⚠️  Timestamp di giunzione: {JUNCTION_TIMESTAMP}")
    print(f"   - Candele PRIMA: lasciate intatte (storico corretto)")
    print(f"   - Candele DA: ricalcolate con offset storico")
    print()

    response = input("Vuoi procedere con il raccordo? (y/n) ")
    if response.lower() != 'y':
        print("Annullato.")
        return

    reconnect_data()

    print()
    print("✅ RACCORDO COMPLETATO!")

if __name__ == '__main__':
    main()
