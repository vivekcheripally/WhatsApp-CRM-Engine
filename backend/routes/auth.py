from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from core.config import settings
from core.database import get_db
from core.exceptions import ValidationError, ResourceNotFoundError
from routes.deps import get_current_user
from schemas.auth import LoginRequest, ForceChangePasswordRequest, ChangePasswordRequest
from services.auth_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login")
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    try:
        auth_data = AuthService(db).authenticate_user(
            email=payload.email,
            password=payload.password,
            remember_me=payload.remember_me,
        )

        max_age = (7 * 24 * 3600) if payload.remember_me else None

        # Store Long-Lived Refresh Token in HttpOnly Cookie
        response.set_cookie(
            key="refresh_token",
            value=auth_data["refresh_token"],
            httponly=True,
            secure=settings.COOKIE_SECURE,
            samesite=settings.COOKIE_SAMESITE,
            max_age=max_age,
        )

        # Clear legacy cookie if present
        response.delete_cookie(key="access_token", httponly=True, secure=settings.COOKIE_SECURE, samesite=settings.COOKIE_SAMESITE)

        return auth_data
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/refresh")
def refresh_token(request: Request, response: Response, db: Session = Depends(get_db)):
    token_str = request.cookies.get("refresh_token")
    if not token_str:
        # Fallback to Authorization header if cookie not present
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token_str = auth_header[7:]

    if not token_str:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token required in HttpOnly cookie")

    try:
        return AuthService(db).refresh_access_token(token_str)
    except ValidationError as e:
        response.delete_cookie(key="refresh_token", httponly=True, secure=settings.COOKIE_SECURE, samesite=settings.COOKIE_SAMESITE)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.post("/revoke-all")
def revoke_all_sessions(
    response: Response,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("id") or current_user.get("sub")
    res = AuthService(db).revoke_all_user_sessions(user_id)
    response.delete_cookie(key="refresh_token", httponly=True, secure=settings.COOKIE_SECURE, samesite=settings.COOKIE_SAMESITE)
    response.delete_cookie(key="access_token", httponly=True, secure=settings.COOKIE_SECURE, samesite=settings.COOKIE_SAMESITE)
    return res


@router.post("/force-change-password")
def force_change_password(
    payload: ForceChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        user_id = current_user.get("id") or current_user.get("sub")
        return AuthService(db).force_change_password(
            user_id=user_id,
            new_password=payload.new_password,
            confirm_password=payload.confirm_password,
        )
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        user_id = current_user.get("id") or current_user.get("sub")
        return AuthService(db).change_password(
            user_id=user_id,
            old_password=payload.old_password,
            new_password=payload.new_password,
            confirm_password=payload.confirm_password,
        )
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user


@router.post("/logout")
def logout(response: Response, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    sid = current_user.get("sid")
    if sid:
        AuthService(db).revoke_session(sid)
    response.delete_cookie(key="refresh_token", httponly=True, secure=settings.COOKIE_SECURE, samesite=settings.COOKIE_SAMESITE)
    response.delete_cookie(key="access_token", httponly=True, secure=settings.COOKIE_SECURE, samesite=settings.COOKIE_SAMESITE)
    return {"message": "Successfully logged out"}


