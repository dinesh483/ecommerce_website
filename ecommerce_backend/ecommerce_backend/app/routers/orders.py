from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app import models, schemas, auth

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.post("/", response_model=schemas.OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(
    order_in: schemas.OrderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if not order_in.items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")

    total_amount = 0.0
    order_items = []

    # Validate stock and compute total before committing anything
    for item in order_in.items:
        product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        if not product or not product.is_active:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        if product.stock < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for '{product.name}'. Available: {product.stock}",
            )
        total_amount += product.price * item.quantity
        order_items.append((product, item.quantity))

    order = models.Order(
        user_id=current_user.id,
        total_amount=total_amount,
        shipping_address=order_in.shipping_address,
        status=models.OrderStatus.pending,
    )
    db.add(order)
    db.flush()  # get order.id before commit

    for product, quantity in order_items:
        product.stock -= quantity
        db.add(
            models.OrderItem(
                order_id=order.id,
                product_id=product.id,
                quantity=quantity,
                price_at_purchase=product.price,
            )
        )

    db.commit()
    db.refresh(order)
    return order


@router.get("/my-orders", response_model=List[schemas.OrderOut])
def get_my_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return (
        db.query(models.Order)
        .filter(models.Order.user_id == current_user.id)
        .order_by(models.Order.created_at.desc())
        .all()
    )


@router.get("/{order_id}", response_model=schemas.OrderOut)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to view this order")
    return order


@router.get("/", response_model=List[schemas.OrderOut])
def list_all_orders(
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.get_current_admin_user),
):
    return db.query(models.Order).order_by(models.Order.created_at.desc()).all()


@router.patch("/{order_id}/status", response_model=schemas.OrderOut)
def update_order_status(
    order_id: int,
    status_in: schemas.OrderStatusUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.get_current_admin_user),
):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = status_in.status
    db.commit()
    db.refresh(order)
    return order


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this order")
    if order.status not in (models.OrderStatus.pending, models.OrderStatus.processing):
        raise HTTPException(status_code=400, detail="Order can no longer be cancelled")

    # Restock items
    for item in order.items:
        if item.product:
            item.product.stock += item.quantity

    order.status = models.OrderStatus.cancelled
    db.commit()
    return None
