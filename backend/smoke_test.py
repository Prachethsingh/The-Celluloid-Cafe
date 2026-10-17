#!/usr/bin/env python3
"""Quick smoke test to ensure the API starts and responds."""
import sys
import time

import httpx

def main() -> None:
    base_url = "http://localhost:8000"
    print(f"Checking if API is up at {base_url}...")
    for i in range(30):  # wait up to 30 seconds
        try:
            resp = httpx.get(f"{base_url}/health", timeout=2.0)
            if resp.status_code == 200:
                print("✅ API is healthy")
                # Test a simple endpoint
                resp = httpx.get(f"{base_url}/api/v1/movies/", timeout=5.0)
                if resp.status_code == 200:
                    print("✅ Movies endpoint responds")
                    print("🎉 Smoke test passed")
                    return
                else:
                    print(f"❌ Movies endpoint failed: {resp.status_code}")
                    sys.exit(1)
        except Exception as exc:
            print(f"Attempt {i+1}/30: API not ready yet ({exc})")
            time.sleep(1)
    print("❌ API did not become healthy in time")
    sys.exit(1)

if __name__ == "__main__":
    main()