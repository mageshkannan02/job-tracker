import pytest
from services.extractor_service import validate_url


def test_validate_url_blocks_localhost():
    """Verify localhost targets are blocked."""
    with pytest.raises(ValueError, match="restricted"):
        validate_url("http://localhost:8000/api")

    with pytest.raises(ValueError, match="restricted"):
        validate_url("http://127.0.0.1/admin")

    with pytest.raises(ValueError, match="restricted"):
        validate_url("http://0.0.0.0:3000")


def test_validate_url_blocks_private_ip_ranges():
    """Verify private subnet addresses are blocked."""
    with pytest.raises(ValueError, match="restricted"):
        validate_url("http://192.168.1.1/secret")

    with pytest.raises(ValueError, match="restricted"):
        validate_url("http://10.0.0.5/jobs")

    with pytest.raises(ValueError, match="restricted"):
        validate_url("http://172.16.0.10/metadata")


def test_validate_url_invalid_schemes():
    """Verify non-HTTP schemes are rejected."""
    with pytest.raises(ValueError, match="scheme"):
        validate_url("file:///etc/passwd")

    with pytest.raises(ValueError, match="scheme"):
        validate_url("ftp://ftp.example.com/file")


def test_validate_url_valid():
    """Verify valid public HTTP/HTTPS URLs pass."""
    url = "https://example.com/careers/engineer"
    validated = validate_url(url)
    assert validated == url
