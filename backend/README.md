# AuraCare FastAPI Companion Backend

This directory provides the Python FastAPI backend implementation matching Section 2 of your architectural blueprint.

## Features
- **FastAPI** with automatic OpenAPI / Swagger interactive documentation (`http://localhost:8000/docs`).
- **Strict Capability Execution**: Enforces that AI cannot write directly to databases or EHR.
- **Tenant Isolation**: Validates hospital tenant boundaries on every capability request.
- **Pydantic V2 Schemas**: Strict request/response typing and serialization.

## Quickstart

```bash
# 1. Navigate to backend directory
cd backend

# 2. Create virtual environment
python -m venv venv

# 3. Activate virtual environment
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# 4. Install dependencies
pip install -r requirements.txt

# 5. Start the FastAPI server
uvicorn main:app --reload --port 8000
```

Once running, visit:
- **Interactive Swagger UI**: `http://localhost:8000/docs`
- **ReDoc Documentation**: `http://localhost:8000/redoc`
- **Healthcheck**: `http://localhost:8000/health`
