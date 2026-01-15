# 📧 SmartInbox

> AI-Powered Email Classification System with Gmail Integration

![Python](https://img.shields.io/badge/Python-3.9+-blue)
![React](https://img.shields.io/badge/React-18-61DAFB)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688)

## ✨ Features

- 🤖 **Semantic Classification** - AI-powered email categorization using local embeddings
- 📬 **Gmail Integration** - Full OAuth2 sync with read/star/delete/send operations
- 🎨 **Modern Dark UI** - Superhuman-inspired interface with lightning-fast interactions
- 🔍 **Advanced Search** - Filter by date, sender, category, attachments
- 🏷️ **8 Smart Categories** - Work, Personal, Social, Promotions, Updates, Finance, Newsletters, Primary

## 🛠️ Tech Stack

| Backend | Frontend |
|---------|----------|
| FastAPI | React 18 |
| SQLAlchemy | Vite |
| sentence-transformers | TailwindCSS |
| Gmail API | |

## 🚀 Quick Start

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install && npm run dev
```

## 📁 Structure

```
├── backend/
│   ├── app/
│   │   ├── api/routes.py              # API endpoints
│   │   ├── models/                    # User, Email, Label models
│   │   └── services/
│   │       ├── gmail_service.py       # Gmail OAuth & API
│   │       ├── semantic_classifier.py # AI classification
│   │       └── local_embeddings.py    # Vector embeddings
│   └── main.py
└── frontend/src/
    ├── components/                    # React components
    ├── services/api.js               # API client
    └── MainApp.jsx                   # Main application
```

## 🔌 API

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/google` | Google OAuth login |
| `GET /api/emails` | List emails |
| `POST /api/emails/sync` | Sync from Gmail |
| `GET /api/emails/search` | Advanced search |
| `PATCH /api/emails/{id}/category` | Update category |

## 🧠 How Classification Works

1. Email text → Vector embedding (sentence-transformers/all-MiniLM-L6-v2)
2. Compare with category description embeddings
3. Assign highest cosine similarity category
