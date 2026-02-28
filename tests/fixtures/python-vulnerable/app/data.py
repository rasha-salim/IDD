"""Vulnerable data module with unsafe deserialization."""
import pickle
import yaml
from flask import Flask, request

app = Flask(__name__)


@app.route("/load")
def load_data():
    """Unsafe deserialization: pickle.loads on user input."""
    raw = request.data
    data = pickle.loads(raw)
    return str(data)


@app.route("/config")
def load_config():
    """Unsafe deserialization: yaml.load without SafeLoader."""
    raw = request.data.decode("utf-8")
    config = yaml.load(raw)
    return str(config)


@app.route("/safe-config")
def safe_config():
    """Safe: yaml.load with SafeLoader (should NOT be flagged)."""
    raw = request.data.decode("utf-8")
    config = yaml.load(raw, Loader=yaml.SafeLoader)
    return str(config)
