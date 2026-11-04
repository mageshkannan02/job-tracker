import os
import json
import logging
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import jwt
import requests

from config import settings

logger = logging.getLogger("auth_service")

# JWT configuration
JWT_SECRET = os.getenv("JWT_SECRET", "job-tracker-autumn-secure-jwt-secret-key-2026")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 7

# Seeded user defaults
DEFAULT_USER_EMAIL = os.getenv("DEFAULT_USER_EMAIL", "admin@jobtracker.com")
DEFAULT_USER_PASSWORD = os.getenv("DEFAULT_USER_PASSWORD", "admin123")
DEFAULT_USER_NAME = os.getenv("DEFAULT_USER_NAME", "Admin User")

AUTH_FILE_PATH = Path("./data/user_auth.json")


def hash_password(password: str, salt: Optional[str] = None) -> str:
    """Hash password using PBKDF2 HMAC SHA-256."""
    if not salt:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000).hex()
    return f"{salt}:{hashed}"


def verify_password(plain_password: str, stored_hash: str) -> bool:
    """Verify plaintext password against stored salt:hash."""
    if not stored_hash or ":" not in stored_hash:
        return False
    salt, expected_hash = stored_hash.split(":", 1)
    computed_hash = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 100_000).hex()
    return hmac.compare_digest(computed_hash, expected_hash)


def get_or_create_seeded_user() -> Dict[str, Any]:
    """Retrieve or initialize the single manual seeded user."""
    AUTH_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)

    if AUTH_FILE_PATH.exists():
        try:
            with open(AUTH_FILE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data.get("email"):
                    return data
        except Exception as e:
            logger.warning(f"Error reading auth file, re-initializing: {e}")

    # Seed the single user
    user = {
        "user_id": "user_admin_001",
        "email": DEFAULT_USER_EMAIL.strip().lower(),
        "name": DEFAULT_USER_NAME.strip(),
        "password_hash": hash_password(DEFAULT_USER_PASSWORD),
        "avatar": "",
        "provider": "manual",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    }

    try:
        with open(AUTH_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump(user, f, indent=2)
        logger.info(f"Seeded single manual user initialized with email: {user['email']}")
    except Exception as e:
        logger.error(f"Failed to persist seeded user: {e}")

    return user


def save_user(user: Dict[str, Any]) -> None:
    """Save the single user profile."""
    AUTH_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    user["updated_at"] = datetime.now().isoformat()
    with open(AUTH_FILE_PATH, "w", encoding="utf-8") as f:
        json.dump(user, f, indent=2)


def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    """Validate credentials against the single seeded user."""
    user = get_or_create_seeded_user()
    if email.strip().lower() == user["email"].strip().lower():
        if verify_password(password, user["password_hash"]):
            return get_public_user_profile(user)
    return None


def get_public_user_profile(user: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitize user object for client consumption."""
    return {
        "user_id": user.get("user_id", "user_admin_001"),
        "email": user.get("email", DEFAULT_USER_EMAIL),
        "name": user.get("name", DEFAULT_USER_NAME),
        "avatar": user.get("avatar", ""),
        "provider": user.get("provider", "manual"),
    }


def create_jwt_token(user: Dict[str, Any]) -> str:
    """Generate JWT session token."""
    payload = {
        "sub": user.get("user_id", "user_admin_001"),
        "email": user.get("email", DEFAULT_USER_EMAIL),
        "name": user.get("name", DEFAULT_USER_NAME),
        "exp": datetime.utcnow() + timedelta(days=JWT_EXPIRATION_DAYS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt_token(token: str) -> Optional[Dict[str, Any]]:
    """Validate and decode JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError) as e:
        logger.debug(f"Invalid JWT token: {e}")
        return None


# --- GOOGLE OAUTH FUNCTIONS ---

def get_google_client_credentials() -> Tuple[str, str]:
    """Get Google OAuth client credentials from environment or Excel settings."""
    client_id = os.getenv("GOOGLE_CLIENT_ID") or settings.google_client_id
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET") or settings.google_client_secret

    # Also check Excel settings if empty
    if not client_id or not client_secret:
        try:
            from services import excel_service
            db_settings = excel_service.get_settings(settings.excel_path)
            client_id = client_id or db_settings.get("google_client_id", "")
            client_secret = client_secret or db_settings.get("google_client_secret", "")
        except Exception:
            pass

    return client_id.strip(), client_secret.strip()


def get_google_login_auth_url(redirect_uri: str) -> Dict[str, Any]:
    """Generate Google OAuth authorization URL for login."""
    client_id, _ = get_google_client_credentials()
    if not client_id:
        return {
            "configured": False,
            "auth_url": "",
            "message": "Google Client ID is not configured. You can use the Demo Google Login or Email Login.",
        }

    scopes = [
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
    ]
    scope_str = "%20".join(scopes)

    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={client_id}&"
        f"redirect_uri={redirect_uri}&"
        f"response_type=code&"
        f"scope={scope_str}&"
        f"access_type=offline&"
        f"prompt=select_account"
    )

    return {
        "configured": True,
        "auth_url": auth_url,
    }


def exchange_google_code_for_user(code: str, redirect_uri: str) -> Dict[str, Any]:
    """Exchange authorization code with Google and retrieve user identity."""
    client_id, client_secret = get_google_client_credentials()
    if not client_id or not client_secret:
        raise ValueError("Google OAuth credentials are not configured in settings.")

    token_url = "https://oauth2.googleapis.com/token"
    data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri,
    }

    resp = requests.post(token_url, data=data, timeout=15)
    if resp.status_code != 200:
        logger.error(f"Google token exchange failed: {resp.text}")
        raise ValueError(f"Google authorization failed: {resp.text}")

    tokens = resp.json()
    access_token = tokens.get("access_token")
    if not access_token:
        raise ValueError("No access token returned from Google.")

    # Fetch user info
    userinfo_url = "https://www.googleapis.com/oauth2/v2/userinfo"
    headers = {"Authorization": f"Bearer {access_token}"}
    u_resp = requests.get(userinfo_url, headers=headers, timeout=15)

    if u_resp.status_code != 200:
        raise ValueError("Failed to retrieve user profile from Google.")

    google_user = u_resp.json()
    email = google_user.get("email", "").strip().lower()
    name = google_user.get("name") or google_user.get("given_name") or "Google User"
    avatar = google_user.get("picture", "")

    # Map to our single user or update user profile with Google profile
    user = get_or_create_seeded_user()
    user["name"] = name
    user["avatar"] = avatar
    user["provider"] = "google"
    user["google_id"] = google_user.get("id", "")
    save_user(user)

    return get_public_user_profile(user)


def demo_google_login() -> Dict[str, Any]:
    """Instant one-click demo Google sign-in when Google Client ID isn't configured."""
    user = get_or_create_seeded_user()
    user["name"] = "Google Authenticated User"
    user["provider"] = "google"
    save_user(user)
    return get_public_user_profile(user)

