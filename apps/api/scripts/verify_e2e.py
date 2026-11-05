"""Ensaio isolado. Requer build web pronto, pgserver e CHROME_PATH válido."""

import argparse
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import httpx
import pgserver


def main(postgres_tests: bool) -> int:
    root = Path(__file__).resolve().parents[3]
    python = root / "apps/api/.venv/bin/python"
    chrome = os.environ.get("CHROME_PATH") or shutil.which("chromium")
    if not chrome and sys.platform == "darwin":
        chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    if not chrome or not Path(chrome).is_file():
        print("Defina CHROME_PATH com o caminho de um Chromium/Chrome instalado.")
        return 1
    if not (root / "apps/web/dist/index.html").is_file():
        print("Compile apps/web antes do ensaio.")
        return 1
    work = Path(tempfile.mkdtemp(prefix="aventuras-pin-e2e-"))
    print(f"Evidências locais: {work}", flush=True)
    server = pgserver.get_server(work / "postgres")
    api = None
    try:
        env = os.environ.copy()
        env["TEST_DATABASE_URL"] = server.get_uri().replace(
            "postgresql://", "postgresql+asyncpg://", 1
        )
        if postgres_tests:
            result = subprocess.run(
                [str(python), "-m", "pytest", "-c", str(root / "apps/api/pyproject.toml"),
                 str(root / "apps/api/tests"), "-q"],
                env=env, check=False,
            )
            if result.returncode:
                return result.returncode
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        env.update({
            "AVENTURAS_DATABASE_URL": env["TEST_DATABASE_URL"],
            "AVENTURAS_TUTOR_CODE": "TUTOR-ENSAIO",
            "AVENTURAS_COOKIE_SECURE": "false",
            "AVENTURAS_WEB_DIST": str(root / "apps/web/dist"),
            "AVENTURAS_UNLOCK_WORDS": "",
            "AVENTURAS_UNLOCK_TEMPLATE": "",
            "AVENTURAS_REWARD_TITLE": "",
            "AVENTURAS_REWARD_TEXT": "",
            "BASE_URL": f"http://127.0.0.1:{port}",
            "CHROME_PATH": chrome,
            "SHOTS_DIR": str(work / "shots"),
            "CI": "true",
            "TUTOR_CODE": "TUTOR-ENSAIO",
        })
        with (work / "api.log").open("w") as log:
            api = subprocess.Popen(
                [str(python), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1",
                 "--port", str(port), "--log-level", "warning"],
                cwd=root / "apps/api", env=env, stdout=log, stderr=log,
            )
            for _ in range(100):
                if api.poll() is not None:
                    break
                try:
                    if httpx.get(env["BASE_URL"] + "/api/health", timeout=1).status_code == 200:
                        result = subprocess.run(
                            ["node", "e2e/run.mjs"], cwd=root / "apps/web", env=env,
                            timeout=600, check=False,
                        )
                        print(f"E2E: saída {result.returncode}", flush=True)
                        return result.returncode
                except httpx.HTTPError:
                    pass
                time.sleep(0.2)
        print(f"API não ficou pronta; confira {work / 'api.log'}.")
        return 1
    finally:
        if api is not None and api.poll() is None:
            api.terminate()
            try:
                api.wait(timeout=10)
            except subprocess.TimeoutExpired:
                api.kill()
                api.wait()
        server.cleanup()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--postgres-tests", action="store_true")
    args = parser.parse_args()
    sys.exit(main(args.postgres_tests))
