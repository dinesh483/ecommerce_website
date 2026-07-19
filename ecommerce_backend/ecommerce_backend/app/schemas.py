from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.models import OrderStatus


# ---------- USER ----------
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None


class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    is_admin: bool
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None


# ---------- CATEGORY ----------
class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class CategoryOut(CategoryBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# ---------- PRODUCT ----------
class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = None
    price: float = Field(..., gt=0)
    stock: int = Field(0, ge=0)
    image_url: Optional[str] = None
    category_id: Optional[int] = None
    is_active: bool = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = Field(None, gt=0)
    stock: Optional[int] = Field(None, ge=0)
    image_url: Optional[str] = None
    category_id: Optional[int] = None
    is_active: Optional[bool] = None


class ProductOut(ProductBase):
    id: int
    created_at: datetime
    category: Optional[CategoryOut] = None

    model_config = ConfigDict(from_attributes=True)


# ---------- ORDER ----------
class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)


class OrderCreate(BaseModel):
    shipping_address: Optional[str] = None
    items: List[OrderItemCreate]


class OrderItemOut(BaseModel):
    id: int
    product_id: Optional[int]
    quantity: int
    price_at_purchase: float
    product: Optional[ProductOut] = None

    model_config = ConfigDict(from_attributes=True)


class OrderOut(BaseModel):
    id: int
    user_id: int
    total_amount: float
    status: OrderStatus
    shipping_address: Optional[str] = None
    created_at: datetime
    items: List[OrderItemOut] = []

    model_config = ConfigDict(from_attributes=True)


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
