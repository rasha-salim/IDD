"""Data models for the application."""


class BaseModel:
    """Base model with common attributes."""

    def __init__(self, id: int, created_at: str):
        self.id = id
        self.created_at = created_at

    def to_dict(self) -> dict:
        return {"id": self.id, "created_at": self.created_at}


class User(BaseModel):
    """User model with authentication data."""

    def __init__(self, id: int, name: str, email: str, created_at: str):
        super().__init__(id, created_at)
        self.name = name
        self.email = email
        self._password_hash: str = ""

    def set_password(self, password: str) -> None:
        self._password_hash = hash_password(password)

    def check_password(self, password: str) -> bool:
        return verify_password(password, self._password_hash)

    def to_dict(self) -> dict:
        base = super().to_dict()
        base.update({"name": self.name, "email": self.email})
        return base


class Product(BaseModel):
    """Product in the catalog."""

    def __init__(self, id: int, title: str, price: float, created_at: str):
        super().__init__(id, created_at)
        self.title = title
        self.price = price

    @staticmethod
    def validate_price(price: float) -> bool:
        return price >= 0


def hash_password(password: str) -> str:
    """Hash a password for storage."""
    import hashlib
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against a hash."""
    return hash_password(password) == password_hash
