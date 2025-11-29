#!/usr/bin/env python3
"""
Ricalcola i valori cumulative per cvd_candles in ordine cronologico.
Risolve le discontinuità causate dall'import di dati storici.
"""

import os
import sys
import psycopg2

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://quant_user:quant_password_2024@localhost:5432/quant_tools')

def recalculate_cumulative(conn):
    """Ricalcola tutti i cumulative in ordine cronologico."""

    with conn.cursor() as cur:
        # Leggi tutte le candele in ordine cronologico
        cur.execute("""
            SELECT id, signal, cumulative_v3
            FROM cvd_candles
            ORDER BY timestamp ASC
        """)

        candles = cur.fetchall()
        print(f"📊 Trovate {len(candles)} candele da ricalcolare")

        # Valori iniziali
        cumulative_v1 = 0
        cumulative_v2 = 0
        cumulative_v3 = 0
        cumulative_v3_ema = 0
        ema_alpha = 0.1  # Parametro EMA

        updates = []

        for candle_id, signal, old_v3 in candles:
            # Cumulative V1: somma semplice dei segnali
            cumulative_v1 += signal if signal else 0

            # Cumulative V2: somma pesata (segnali forti contano di più)
            if signal:
                weight = abs(signal) / 3.0  # Normalizza -3/+3 a 0-1
                cumulative_v2 += signal * weight

            # Cumulative V3: reset su cambio direzione
            if signal and cumulative_v3 != 0:
                if (signal > 0 and cumulative_v3 < 0) or (signal < 0 and cumulative_v3 > 0):
                    cumulative_v3 = 0
            cumulative_v3 += signal if signal else 0

            # Cumulative V3 EMA
            if cumulative_v3_ema == 0:
                cumulative_v3_ema = cumulative_v3
            else:
                cumulative_v3_ema = ema_alpha * cumulative_v3 + (1 - ema_alpha) * cumulative_v3_ema

            updates.append((
                round(cumulative_v1, 2),
                round(cumulative_v2, 2),
                round(cumulative_v3, 2),
                round(cumulative_v3_ema, 2),
                candle_id
            ))

        # Update in batch
        print("💾 Aggiornamento database...")
        cur.executemany("""
            UPDATE cvd_candles
            SET cumulative_v1 = %s,
                cumulative_v2 = %s,
                cumulative_v3 = %s,
                cumulative_v3_ema = %s
            WHERE id = %s
        """, updates)

        conn.commit()
        print(f"✅ Aggiornate {len(updates)} candele")

        # Mostra statistiche finali
        cur.execute("""
            SELECT
                MIN(cumulative_v1) as min_v1, MAX(cumulative_v1) as max_v1,
                MIN(cumulative_v2) as min_v2, MAX(cumulative_v2) as max_v2,
                MIN(cumulative_v3) as min_v3, MAX(cumulative_v3) as max_v3
            FROM cvd_candles
        """)
        stats = cur.fetchone()
        print(f"\n📈 Range finali:")
        print(f"  V1: {stats[0]:.2f} → {stats[1]:.2f}")
        print(f"  V2: {stats[2]:.2f} → {stats[3]:.2f}")
        print(f"  V3: {stats[4]:.2f} → {stats[5]:.2f}")

def main():
    print("=" * 50)
    print("RICALCOLO CUMULATIVE CVD")
    print("=" * 50)
    print()

    print("📡 Connessione al database...")
    try:
        conn = psycopg2.connect(DATABASE_URL)
    except Exception as e:
        print(f"❌ Errore: {e}")
        sys.exit(1)

    response = input("Vuoi procedere con il ricalcolo? (y/n) ")
    if response.lower() != 'y':
        print("Annullato.")
        return

    recalculate_cumulative(conn)
    conn.close()

    print("\n✅ COMPLETATO!")

if __name__ == '__main__':
    main()
