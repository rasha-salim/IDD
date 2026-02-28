"""View functions with Flask route decorators."""
from flask import Flask, request, jsonify
from functools import wraps

app = Flask(__name__)


def login_required(f):
    """Decorator to require authentication."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization")
        if not token:
            return jsonify({"error": "unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated


@app.route("/health")
def health_check():
    """Public health check endpoint."""
    return jsonify({"status": "ok"})


@app.route("/users")
@login_required
def list_users():
    """List all users (protected)."""
    return jsonify({"users": []})


@app.route("/users/<int:user_id>")
@login_required
def get_user(user_id: int):
    """Get a single user (protected)."""
    return jsonify({"user": {"id": user_id}})
