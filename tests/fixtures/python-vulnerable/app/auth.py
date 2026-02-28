"""Vulnerable auth module with hardcoded secrets and missing auth."""
from flask import Flask, request, jsonify

app = Flask(__name__)

# Hardcoded secrets
SECRET_KEY = "super-secret-key-12345"
api_token = "sk-abc123def456ghi789"
db_password = "production_password_123"


@app.route("/admin/dashboard")
def admin_dashboard():
    """Missing auth: admin route without login_required."""
    return jsonify({"data": "admin stuff"})


@app.route("/api/data")
def get_data():
    """Missing auth: API route without login_required."""
    return jsonify({"data": []})


@app.route("/login", methods=["POST"])
def login():
    """Login endpoint (public, should NOT be flagged for missing auth)."""
    username = request.form.get("username")
    password = request.form.get("password")
    if password == db_password:
        return jsonify({"token": api_token})
    return jsonify({"error": "invalid"}), 401
