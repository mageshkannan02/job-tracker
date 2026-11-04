import asyncio
import ipaddress
import logging
import re
import socket
from urllib.parse import urlparse
from typing import Tuple, Optional

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger("extractor_service")

BLOCKED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1", "0.0.0.0"}
BLOCKED_PREFIXES = [
    "10.",
    "172.16.", "172.17.", "172.18.", "172.19.", "172.20.",
    "172.21.", "172.22.", "172.23.", "172.24.", "172.25.",
    "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.",
    "192.168.",
    "169.254.",
    "127.",
]

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

MAX_CONTENT_BYTES = 5 * 1024 * 1024  # 5 MB


def validate_url(url: str) -> str:
    """Validate URL is safe (no SSRF). Raise ValueError if unsafe."""
    if not url or not isinstance(url, str):
        raise ValueError("URL must be a non-empty string.")

    cleaned_url = url.strip()
    parsed = urlparse(cleaned_url)

    if parsed.scheme.lower() not in ("http", "https"):
        raise ValueError(f"Invalid URL scheme '{parsed.scheme}'. Only http and https are allowed.")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("Invalid URL: missing hostname.")

    hostname_lower = hostname.lower()
    if hostname_lower in BLOCKED_HOSTS or any(hostname_lower.startswith(p) for p in BLOCKED_PREFIXES):
        raise ValueError(f"Access to restricted hostname '{hostname}' is prohibited.")

    # DNS Resolution check
    try:
        addr_info = socket.getaddrinfo(hostname, None)
    except socket.gaierror as e:
        raise ValueError(f"Could not resolve hostname '{hostname}': {e}")

    for item in addr_info:
        ip_str = item[4][0]
        try:
            ip_obj = ipaddress.ip_address(ip_str)
            if (
                ip_obj.is_private
                or ip_obj.is_loopback
                or ip_obj.is_link_local
                or ip_obj.is_reserved
                or ip_obj.is_multicast
            ):
                raise ValueError(f"URL resolves to restricted IP address '{ip_str}'.")
            if any(ip_str.startswith(p) for p in BLOCKED_PREFIXES):
                raise ValueError(f"URL resolves to blocked IP range '{ip_str}'.")
        except ValueError as ve:
            if "restricted" in str(ve) or "blocked" in str(ve):
                raise ve
            pass

    return cleaned_url


def fetch_with_requests(url: str) -> str:
    """Fetch page with requests + BeautifulSoup, return text content."""
    valid_url = validate_url(url)

    response = requests.get(
        valid_url,
        headers=DEFAULT_HEADERS,
        timeout=15,
        stream=True,
        allow_redirects=True,
    )
    response.raise_for_status()

    # Content-type check
    content_type = response.headers.get("Content-Type", "").lower()
    if not any(t in content_type for t in ("text/html", "application/xhtml+xml", "text/plain")):
        raise ValueError(f"Unsupported Content-Type '{content_type}'. Expected text/html.")

    # Read up to MAX_CONTENT_BYTES
    content_chunks = []
    total_bytes = 0
    for chunk in response.iter_content(chunk_size=65536):
        total_bytes += len(chunk)
        content_chunks.append(chunk)
        if total_bytes >= MAX_CONTENT_BYTES:
            logger.warning(f"Downloaded content truncated at {MAX_CONTENT_BYTES} bytes.")
            break

    raw_html = b"".join(content_chunks).decode(response.encoding or "utf-8", errors="replace")

    # Clean with BeautifulSoup
    soup = BeautifulSoup(raw_html, "html.parser")

    # Remove non-content tags
    for tag in soup(["script", "style", "nav", "footer", "header", "noscript", "svg", "form", "aside", "meta", "link"]):
        tag.decompose()

    text = soup.get_text(separator="\n", strip=True)

    # Normalize multiple newlines and spaces
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines()]
    clean_text = "\n".join(line for line in lines if line)

    return clean_text


async def fetch_with_playwright(url: str) -> str:
    """Fallback: use Playwright to render JS page, return text."""
    valid_url = validate_url(url)
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.warning("Playwright is not installed. Skipping JS rendering.")
        return ""

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
            )
            context = await browser.new_context(
                user_agent=DEFAULT_HEADERS["User-Agent"],
                viewport={"width": 1280, "height": 800},
            )
            page = await context.new_page()

            try:
                await page.goto(valid_url, wait_until="domcontentloaded", timeout=20000)
                # Brief wait for client-side rendering
                await page.wait_for_timeout(2000)
            except Exception as nav_err:
                logger.warning(f"Playwright navigation warning for {url}: {nav_err}")

            raw_text = await page.evaluate("() => document.body.innerText")
            await browser.close()

            if not raw_text:
                return ""

            lines = [re.sub(r"[ \t]+", " ", line).strip() for line in raw_text.splitlines()]
            return "\n".join(line for line in lines if line)
    except Exception as e:
        logger.error(f"Playwright execution error: {e}")
        return ""


async def extract_job_text(url: str) -> Tuple[str, str]:
    """Main extraction: try requests first, playwright as fallback.
    Returns (text_content, method_used).
    """
    valid_url = validate_url(url)

    # Step 1: Try requests
    try:
        text = await asyncio.to_thread(fetch_with_requests, valid_url)
        # If text is substantial (> 400 characters), requests succeeded
        if len(text) >= 400:
            return text, "requests"
        logger.info(f"Requests returned limited text ({len(text)} chars). Trying Playwright...")
    except Exception as e:
        logger.info(f"Requests fetch failed ({e}). Falling back to Playwright...")

    # Step 2: Try Playwright fallback
    try:
        pw_text = await fetch_with_playwright(valid_url)
        if pw_text and len(pw_text) > 100:
            return pw_text, "playwright"
    except Exception as e:
        logger.error(f"Playwright fallback failed: {e}")

    # If requests got some text, return that as best effort
    if 'text' in locals() and text:
        return text, "requests"

    raise RuntimeError(f"Failed to extract readable text content from URL: {url}")
