import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, EmailStr

from services import auth_service

logger = logging.getLogger("routes.auth")
router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleCallbackRequest(BaseModel):
    code: str
    redirect_uri: str


def get_current_user_token(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Dependency to validate JWT Bearer token from request header."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Expected 'Bearer <token>'.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = parts[1]
    payload = auth_service.decode_jwt_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid token. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


@router.post("/login")
def login(req: LoginRequest) -> Dict[str, Any]:
    """Authenticate with manual seeded user email and password."""
    user = auth_service.authenticate_user(req.email, req.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please verify your credentials.",
        )

    token = auth_service.create_jwt_token(user)
    return {
        "success": True,
        "token": token,
        "token_type": "bearer",
        "user": user,
    }


@router.get("/google/url")
def get_google_auth_url(
    redirect_uri: Optional[str] = Query(None)
) -> Dict[str, Any]:
    """Get Google OAuth URL for user authentication."""
    target_uri = (
        redirect_uri
        or (f"{settings.frontend_url.rstrip('/')}/login/callback" if getattr(settings, "frontend_url", "") else None)
        or f"http://localhost:{settings.frontend_port}/login/callback"
    )
    return auth_service.get_google_login_auth_url(target_uri)


@router.post("/google/callback")
def google_callback(req: GoogleCallbackRequest) -> Dict[str, Any]:
    """Exchange authorization code from Google OAuth for authenticated user session."""
    try:
        user = auth_service.exchange_google_code_for_user(req.code, req.redirect_uri)
        token = auth_service.create_jwt_token(user)
        return {
            "success": True,
            "token": token,
            "token_type": "bearer",
            "user": user,
        }
    except Exception as e:
        logger.error(f"Google login failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e) or "Google sign-in authentication failed.",
        )


@router.post("/google/demo")
def google_demo_login() -> Dict[str, Any]:
    """One-click instant Google Sign-In demo mode when Google Client ID is not configured."""
    user = auth_service.demo_google_login()
    token = auth_service.create_jwt_token(user)
    return {
        "success": True,
        "token": token,
        "token_type": "bearer",
        "user": user,
    }


@router.get("/me")
def get_current_user(token_payload: Dict[str, Any] = Depends(get_current_user_token)) -> Dict[str, Any]:
    """Get the currently authenticated user's profile."""
    user = auth_service.get_or_create_seeded_user()
    profile = auth_service.get_public_user_profile(user)
    # If the token payload has a specific provider or name (e.g. Google login), preserve it
    if token_payload.get("provider"):
        profile["provider"] = token_payload.get("provider")
    if token_payload.get("name"):
        profile["name"] = token_payload.get("name")
    return profile


@router.get("/seeded-credentials")
def get_seeded_credentials_hint() -> Dict[str, Any]:
    """Return default seeded user credentials for convenience in development."""
    return {
        "email": auth_service.DEFAULT_USER_EMAIL,
        "password": auth_service.DEFAULT_USER_PASSWORD,
    }


@router.post("/logout")
def logout() -> Dict[str, Any]:
    """Sign out the current user."""
    return {
        "success": True,
        "message": "Logged out successfully.",
    }

