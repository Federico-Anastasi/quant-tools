"""
Concurrent Users Stress Test - Simulates realistic user behavior
Tests psiquant.xyz backend capacity with N concurrent users

Usage:
    python test_concurrent_users.py --users 20 --duration 120
"""

import asyncio
import aiohttp
import time
import random
import argparse
from datetime import datetime
from typing import List, Dict

# ============================================================
# CONFIG
# ============================================================
API_URL = "https://psiquant.xyz"  # Production URL
POLLING_INTERVAL_AVG = 4.0  # Average 3-5 seconds

# User behavior distribution (realistic)
USER_BEHAVIORS = {
    'cvd_only': 0.80,      # 80% watch only CVD chart
    'cvd_lob': 0.15,       # 15% also open LOB tab
    'cvd_zones': 0.05      # 5% also open Zones tab
}

# ============================================================
# SIMULATED USER CLASS
# ============================================================

class SimulatedUser:
    """Simulates a single user session with realistic behavior"""

    def __init__(self, user_id: int, behavior: str):
        self.user_id = user_id
        self.behavior = behavior
        self.session = None
        self.stats = {
            'requests': 0,
            'success': 0,
            'errors': 0,
            'timeouts': 0,
            'total_time': 0.0,
            'max_time': 0.0,
            'min_time': float('inf')
        }

    async def make_request(self, method: str, endpoint: str, json_data=None) -> tuple:
        """Make HTTP request with error handling and timing"""
        start = time.time()

        try:
            url = f"{API_URL}{endpoint}"
            timeout = aiohttp.ClientTimeout(total=30)

            if method == 'GET':
                async with self.session.get(url, timeout=timeout, ssl=False) as resp:
                    data = await resp.json()
                    elapsed = time.time() - start

                    self.stats['requests'] += 1
                    self.stats['total_time'] += elapsed
                    self.stats['max_time'] = max(self.stats['max_time'], elapsed)
                    self.stats['min_time'] = min(self.stats['min_time'], elapsed)

                    if resp.status == 200:
                        self.stats['success'] += 1
                        return data, elapsed, True
                    else:
                        self.stats['errors'] += 1
                        return None, elapsed, False

            elif method == 'POST':
                async with self.session.post(url, json=json_data, timeout=timeout, ssl=False) as resp:
                    data = await resp.json()
                    elapsed = time.time() - start

                    self.stats['requests'] += 1
                    self.stats['total_time'] += elapsed
                    self.stats['max_time'] = max(self.stats['max_time'], elapsed)
                    self.stats['min_time'] = min(self.stats['min_time'], elapsed)

                    if resp.status == 200:
                        self.stats['success'] += 1
                        return data, elapsed, True
                    else:
                        self.stats['errors'] += 1
                        return None, elapsed, False

        except asyncio.TimeoutError:
            elapsed = time.time() - start
            self.stats['requests'] += 1
            self.stats['timeouts'] += 1
            self.stats['errors'] += 1
            self.stats['total_time'] += elapsed
            print(f"[USER {self.user_id}] ⏱️  TIMEOUT on {endpoint} ({elapsed:.1f}s)")
            return None, elapsed, False

        except Exception as e:
            elapsed = time.time() - start
            self.stats['requests'] += 1
            self.stats['errors'] += 1
            self.stats['total_time'] += elapsed
            print(f"[USER {self.user_id}] ❌ ERROR on {endpoint}: {str(e)[:50]}")
            return None, elapsed, False

    async def initial_load(self):
        """Simulates dashboard initial load (realistic user behavior)"""
        print(f"[USER {self.user_id}] 🚀 Initial load ({self.behavior})")

        # 1. Load candles (1000 for full chart)
        await self.make_request('GET', '/api/candles?limit=1000')

        # 2. Load bots list
        bots_data, _, success = await self.make_request('GET', '/api/bots')

        if success and bots_data:
            bot_ids = [bot['id'] for bot in bots_data.get('bots', [])]

            # 3. Load equity for all bots (bulk request)
            if bot_ids:
                await self.make_request('POST', '/api/bots/equity-bulk', {
                    'bot_ids': bot_ids,
                    'from_time': None,
                    'to_time': None
                })

        # 4. If user clicks LOB tab (15% of users)
        if self.behavior == 'cvd_lob':
            await asyncio.sleep(random.uniform(2, 5))  # Wait before clicking
            await self.make_request('GET', '/api/lob-density?hours=720&price_bin=50')

        # 5. If user clicks Zones tab (5% of users)
        elif self.behavior == 'cvd_zones':
            await asyncio.sleep(random.uniform(2, 5))
            await self.make_request('GET', '/api/order-flow-zones?symbol=BTC')

    async def polling_loop(self, duration: int):
        """Simulates continuous polling (realistic intervals)"""
        start_time = time.time()
        poll_count = 0

        while (time.time() - start_time) < duration:
            poll_count += 1

            # Polling: latest candles update
            await self.make_request('GET', '/api/candles?limit=100')

            # Polling: updated equity
            bots_data, _, success = await self.make_request('GET', '/api/bots')
            if success and bots_data:
                bot_ids = [bot['id'] for bot in bots_data.get('bots', [])]
                if bot_ids:
                    await self.make_request('POST', '/api/bots/equity-bulk', {
                        'bot_ids': bot_ids,
                        'from_time': None,
                        'to_time': None
                    })

            # Random interval 3-5 seconds (realistic user behavior)
            interval = random.uniform(3.0, 5.0)
            await asyncio.sleep(interval)

        print(f"[USER {self.user_id}] ✅ Completed {poll_count} polling cycles")

    async def run(self, duration: int):
        """Run complete user simulation"""
        connector = aiohttp.TCPConnector(limit=10)
        async with aiohttp.ClientSession(connector=connector) as session:
            self.session = session

            # 1. Initial dashboard load
            await self.initial_load()

            # 2. Continuous polling
            await self.polling_loop(duration)

        return self.stats

# ============================================================
# STRESS TEST ORCHESTRATOR
# ============================================================

async def run_stress_test(num_users: int, duration: int):
    """Execute stress test with N concurrent users"""

    print(f"\n{'='*70}")
    print(f"🧪 STRESS TEST - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*70}")
    print(f"Target:   {API_URL}")
    print(f"Users:    {num_users}")
    print(f"Duration: {duration}s ({duration//60}m {duration%60}s)")
    print(f"Behavior: 80% CVD only, 15% CVD+LOB, 5% CVD+Zones")
    print(f"{'='*70}\n")

    # Create users with behavior distribution
    users: List[SimulatedUser] = []
    for i in range(num_users):
        rand = random.random()
        if rand < USER_BEHAVIORS['cvd_only']:
            behavior = 'cvd_only'
        elif rand < USER_BEHAVIORS['cvd_only'] + USER_BEHAVIORS['cvd_lob']:
            behavior = 'cvd_lob'
        else:
            behavior = 'cvd_zones'

        users.append(SimulatedUser(user_id=i+1, behavior=behavior))

    # Run all users concurrently
    print(f"🚀 Starting {num_users} concurrent users...\n")
    start_time = time.time()

    tasks = [user.run(duration) for user in users]
    all_stats = await asyncio.gather(*tasks)

    total_duration = time.time() - start_time

    # Aggregate statistics
    total_requests = sum(s['requests'] for s in all_stats)
    total_success = sum(s['success'] for s in all_stats)
    total_errors = sum(s['errors'] for s in all_stats)
    total_timeouts = sum(s['timeouts'] for s in all_stats)
    total_time = sum(s['total_time'] for s in all_stats)

    avg_response_time = total_time / total_requests if total_requests > 0 else 0
    requests_per_second = total_requests / total_duration
    success_rate = (total_success / total_requests * 100) if total_requests > 0 else 0

    max_response = max(s['max_time'] for s in all_stats)
    min_response = min(s['min_time'] for s in all_stats if s['min_time'] != float('inf'))

    # Print detailed report
    print(f"\n{'='*70}")
    print(f"📊 STRESS TEST RESULTS")
    print(f"{'='*70}")
    print(f"Test Duration:       {total_duration:.1f}s")
    print(f"Total Requests:      {total_requests}")
    print(f"  ✅ Success:        {total_success} ({success_rate:.1f}%)")
    print(f"  ❌ Errors:         {total_errors} ({100-success_rate:.1f}%)")
    print(f"  ⏱️  Timeouts:       {total_timeouts}")
    print(f"\nPerformance:")
    print(f"  Throughput:        {requests_per_second:.1f} req/s")
    print(f"  Avg Response:      {avg_response_time*1000:.0f}ms")
    print(f"  Min Response:      {min_response*1000:.0f}ms")
    print(f"  Max Response:      {max_response*1000:.0f}ms")
    print(f"{'='*70}\n")

    # Per-user sample (first 5)
    print("📋 Sample User Stats (first 5 users):")
    for i, stats in enumerate(all_stats[:5]):
        avg_time = stats['total_time'] / stats['requests'] if stats['requests'] > 0 else 0
        success_pct = (stats['success'] / stats['requests'] * 100) if stats['requests'] > 0 else 0
        print(f"  User {i+1:2d}: {stats['requests']:3d} req | "
              f"{stats['success']:3d} OK ({success_pct:5.1f}%) | "
              f"{stats['errors']:2d} ERR | "
              f"avg {avg_time*1000:4.0f}ms | "
              f"max {stats['max_time']*1000:4.0f}ms")

    print(f"\n{'='*70}")

    # Verdict
    if success_rate >= 99 and avg_response_time < 0.2:
        print("✅ VERDICT: EXCELLENT - System handles load perfectly")
    elif success_rate >= 95 and avg_response_time < 0.5:
        print("✅ VERDICT: GOOD - System handles load well")
    elif success_rate >= 90 and avg_response_time < 1.0:
        print("⚠️  VERDICT: ACCEPTABLE - System under stress but functional")
    else:
        print("❌ VERDICT: OVERLOADED - System struggling with load")

    print(f"{'='*70}\n")

# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Stress test for psiquant.xyz')
    parser.add_argument('--users', type=int, default=20, help='Number of concurrent users (default: 20)')
    parser.add_argument('--duration', type=int, default=120, help='Test duration in seconds (default: 120)')

    args = parser.parse_args()

    asyncio.run(run_stress_test(num_users=args.users, duration=args.duration))
