"""Utility functions."""
import os
from typing import Optional


def get_env_var(name: str, default: Optional[str] = None) -> str:
    """Get an environment variable or return default."""
    value = os.environ.get(name, default)
    if value is None:
        raise ValueError(f"Required environment variable {name} not set")
    return value


def format_currency(amount: float, currency: str = "USD") -> str:
    """Format a monetary amount."""
    if currency == "USD":
        return f"${amount:.2f}"
    return f"{amount:.2f} {currency}"


def validate_email(email: str) -> bool:
    """Basic email validation."""
    return "@" in email and "." in email.split("@")[1]
