"""Vulnerable server with SQL injection, command injection, and path traversal."""
import os
import sqlite3
import subprocess
from flask import Flask, request, jsonify

app = Flask(__name__)
db = sqlite3.connect(":memory:")


@app.route("/users/search")
def search_users():
    """SQL injection: user input interpolated into query."""
    name = request.args.get("name")
    cursor = db.cursor()
    cursor.execute(f"SELECT * FROM users WHERE name = '{name}'")
    return jsonify(cursor.fetchall())


@app.route("/run")
def run_command():
    """Command injection: user input in os.system."""
    cmd = request.args.get("cmd")
    os.system(f"echo {cmd}")
    return jsonify({"status": "done"})


@app.route("/exec")
def exec_code():
    """Command injection: user input in eval."""
    expr = request.args.get("expr")
    result = eval(expr)
    return jsonify({"result": str(result)})


@app.route("/files")
def read_file():
    """Path traversal: user input in open() without validation."""
    filename = request.args.get("name")
    content = open(filename).read()
    return content


@app.route("/safe-query")
def safe_query():
    """Safe: parameterized query (should NOT be flagged)."""
    name = request.args.get("name")
    cursor = db.cursor()
    cursor.execute("SELECT * FROM users WHERE name = ?", (name,))
    return jsonify(cursor.fetchall())


@app.route("/safe-file")
def safe_file():
    """Safe: path validation before open (should NOT be flagged)."""
    filename = request.args.get("name")
    safe_path = os.path.abspath(filename)
    if not safe_path.startswith("/allowed/"):
        return "Forbidden", 403
    content = open(safe_path).read()
    return content
