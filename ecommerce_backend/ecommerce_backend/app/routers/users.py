from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app import models, schemas, auth

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/", response_model=List[schemas.UserOut])
def list_users(
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.get_current_admin_user),
):
    return db.query(models.User).all()


@router.patch("/{user_id}/toggle-admin", response_model=schemas.UserOut)
def toggle_admin(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.get_current_admin_user),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_admin = not user.is_admin
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}/toggle-active", response_model=schemas.UserOut)
def toggle_active(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.get_current_admin_user),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return user
