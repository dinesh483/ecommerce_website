from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional

from app.database import get_db
from app import models, schemas, auth

router = APIRouter(prefix="/products", tags=["Products"])


@router.get("/", response_model=List[schemas.ProductOut])
def list_products(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search by product name or description"),
    category_id: Optional[int] = Query(None),
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    active_only: bool = Query(True, description="Only show active/in-catalog products"),
):
    query = db.query(models.Product)

    if active_only:
        query = query.filter(models.Product.is_active == True)  # noqa: E712
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(models.Product.name.ilike(like), models.Product.description.ilike(like))
        )
    if category_id:
        query = query.filter(models.Product.category_id == category_id)
    if min_price is not None:
        query = query.filter(models.Product.price >= min_price)
    if max_price is not None:
        query = query.filter(models.Product.price <= max_price)

    return query.offset(skip).limit(limit).all()


@router.get("/{product_id}", response_model=schemas.ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("/", response_model=schemas.ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    product_in: schemas.ProductCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.get_current_admin_user),
):
    if product_in.category_id:
        category = (
            db.query(models.Category)
            .filter(models.Category.id == product_in.category_id)
            .first()
        )
        if not category:
            raise HTTPException(status_code=400, detail="Category does not exist")

    product = models.Product(**product_in.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.put("/{product_id}", response_model=schemas.ProductOut)
def update_product(
    product_id: int,
    product_in: schemas.ProductUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.get_current_admin_user),
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = product_in.model_dump(exclude_unset=True)

    if "category_id" in update_data and update_data["category_id"] is not None:
        category = (
            db.query(models.Category)
            .filter(models.Category.id == update_data["category_id"])
            .first()
        )
        if not category:
            raise HTTPException(status_code=400, detail="Category does not exist")

    for key, value in update_data.items():
        setattr(product, key, value)

    db.commit()
    db.refresh(product)
    return product


@router.patch("/{product_id}/stock", response_model=schemas.ProductOut)
def update_stock(
    product_id: int,
    quantity_change: int = Query(..., description="Positive to add stock, negative to reduce"),
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.get_current_admin_user),
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    new_stock = product.stock + quantity_change
    if new_stock < 0:
        raise HTTPException(status_code=400, detail="Stock cannot go below zero")
    product.stock = new_stock
    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.get_current_admin_user),
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
    return None
