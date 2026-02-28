"""Additional routes for the application."""
from flask import Blueprint, request, jsonify
from app.models import User
from app.utils import validate_email

api = Blueprint("api", __name__)


@api.route("/register", methods=["POST"])
def register():
    """Public registration endpoint."""
    data = request.json
    email = data.get("email", "")
    if not validate_email(email):
        return jsonify({"error": "Invalid email"}), 400
    return jsonify({"status": "registered"}), 201
