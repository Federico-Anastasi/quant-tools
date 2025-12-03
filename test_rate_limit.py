import requests
import time
from datetime import datetime

URL = "https://psiquant.xyz/api/bots"

def test_rate_limit(requests_per_minute, duration_seconds=60):
    """
    Test rate limiting con carico progressivo

    Args:
        requests_per_minute: Numero richieste target per minuto
        duration_seconds: Durata del test in secondi
    """
    interval = 60.0 / requests_per_minute  # Secondi tra richieste
    total_requests = int((duration_seconds / 60) * requests_per_minute)

    print(f"\n{'='*60}")
    print(f"TEST: {requests_per_minute} req/min per {duration_seconds}s")
    print(f"Interval: {interval:.3f}s | Total requests: {total_requests}")
    print(f"{'='*60}\n")

    success = 0
    blocked = 0
    errors = 0

    start_time = time.time()

    for i in range(total_requests):
        try:
            response = requests.get(URL, timeout=5)

            if response.status_code == 200:
                success += 1
                print(f"[OK] [{i+1}/{total_requests}] 200 OK")
            elif response.status_code == 503:
                blocked += 1
                print(f"[BLOCKED] [{i+1}/{total_requests}] 503 BLOCKED (rate limit)")
            else:
                errors += 1
                print(f"[ERROR] [{i+1}/{total_requests}] {response.status_code}")

        except Exception as e:
            errors += 1
            print(f"[ERROR] [{i+1}/{total_requests}] ERROR: {e}")

        # Sleep per mantenere rate costante
        elapsed = time.time() - start_time
        expected_time = (i + 1) * interval
        sleep_time = max(0, expected_time - elapsed)
        time.sleep(sleep_time)

    duration = time.time() - start_time
    actual_rate = (total_requests / duration) * 60

    print(f"\n{'='*60}")
    print(f"RISULTATI:")
    print(f"  [OK] Success: {success}")
    print(f"  [BLOCKED] Blocked: {blocked}")
    print(f"  [ERROR] Errors: {errors}")
    print(f"  Duration: {duration:.2f}s")
    print(f"  Actual rate: {actual_rate:.1f} req/min")
    print(f"{'='*60}\n")

    return success, blocked, errors

# TEST PROGRESSIVI
if __name__ == "__main__":
    print(f"RATE LIMIT TEST - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # FASE 1: Sotto il limite (dovrebbe funzionare)
    print("\n[FASE 1] Carico normale (100 req/min)")
    test_rate_limit(100, duration_seconds=60)
    time.sleep(5)

    # FASE 2: Vicino al limite (dovrebbe funzionare)
    print("\n[FASE 2] Carico elevato (180 req/min)")
    test_rate_limit(180, duration_seconds=60)
    time.sleep(5)

    # FASE 3: Sul limite (alcune potrebbero essere bloccate)
    print("\n[FASE 3] Sul limite (200 req/min)")
    test_rate_limit(200, duration_seconds=60)
    time.sleep(5)

    # FASE 4: Sopra il limite (dovrebbe bloccare)
    print("\n[FASE 4] Sopra il limite (300 req/min)")
    test_rate_limit(300, duration_seconds=60)
    time.sleep(5)

    # FASE 5: Attacco simulato (dovrebbe bloccare quasi tutto)
    print("\n[FASE 5] Attacco DDoS simulato (1000 req/min)")
    test_rate_limit(1000, duration_seconds=30)  # Solo 30s per non esagerare
