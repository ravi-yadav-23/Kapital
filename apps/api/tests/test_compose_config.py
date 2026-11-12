"""F35: in docker compose the web container must proxy to the api service, not to its own loopback."""
import re
from pathlib import Path

COMPOSE = Path(__file__).resolve().parents[3] / "docker-compose.yml"


def _service_block(name: str) -> str:
    text = COMPOSE.read_text(encoding="utf-8")
    m = re.search(rf"^  {name}:\n(.*?)(?=^  \w[\w-]*:\n|^\w|\Z)", text, re.S | re.M)
    assert m, f"service {name} not found"
    return m.group(1)


def test_web_build_bakes_api_service_hostname_into_rewrites():
    web = _service_block("web")
    assert re.search(r"args:\s+API_URL: http://api:8000", web), "Next rewrites are build-time: pass API_URL as a build arg"
    dockerfile = (COMPOSE.parent / "apps" / "web" / "Dockerfile").read_text(encoding="utf-8")
    assert re.search(r"^ARG API_URL", dockerfile, re.M) and "ENV API_URL=$API_URL" in dockerfile


def test_browser_is_not_given_an_unresolvable_api_hostname():
    web = _service_block("web")
    assert "NEXT_PUBLIC_API_URL=http://api" not in web


def test_obsolete_admin_pin_is_not_configured():
    assert "ADMIN_PIN" not in COMPOSE.read_text(encoding="utf-8")
