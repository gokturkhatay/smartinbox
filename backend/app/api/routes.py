from fastapi import APIRouter, Depends, HTTPException, Query, Response, Cookie, Request, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import secrets
import re
from collections import defaultdict
from time import time
import bleach
from bleach.css_sanitizer import CSSSanitizer

from ..models import get_db, init_db, Email, Label, DEFAULT_LABELS, User, AIFeedback, Attachment
from ..services import GmailService, get_semantic_classifier
from pydantic import BaseModel, EmailStr, validator
import os
import json
import uuid
import aiofiles


router = APIRouter()

# Create uploads directory
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Initialize services
gmail_service = GmailService()

# Always use semantic classifier with local embeddings (FREE, UNLIMITED)
def get_classifier():
    """Get the semantic classifier instance."""
    return get_semantic_classifier()

# Simple session store (in production use Redis/JWT)
sessions = {}

# Rate limiting store (in production use Redis)
rate_limit_store = defaultdict(list)

# Rate limiting decorator
def rate_limit(max_requests: int = 10, window_seconds: int = 60):
    """Rate limiting decorator"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Get client IP from request
            request = kwargs.get('request') or (args[0] if args else None)
            if hasattr(request, 'client'):
                client_ip = request.client.host if request.client else "unknown"
            else:
                client_ip = "unknown"
            
            # Clean old entries
            now = time()
            rate_limit_store[client_ip] = [
                t for t in rate_limit_store[client_ip] 
                if now - t < window_seconds
            ]
            
            # Check rate limit
            if len(rate_limit_store[client_ip]) >= max_requests:
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded. Maximum {max_requests} requests per {window_seconds} seconds."
                )
            
            # Add current request
            rate_limit_store[client_ip].append(now)
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


# ============== Pydantic Models ==============

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    auth_provider: str

class AuthUrlResponse(BaseModel):
    auth_url: str

class AuthCallbackRequest(BaseModel):
    code: str
    redirect_uri: str

class AuthStatusResponse(BaseModel):
    authenticated: bool
    email: Optional[str] = None
    name: Optional[str] = None
    user_id: Optional[int] = None

class EmailResponse(BaseModel):
    id: int
    gmail_id: str
    subject: str
    sender: str
    sender_name: str
    snippet: str
    body: str
    received_at: str
    is_read: bool
    is_starred: bool
    predicted_category: str
    confidence_score: int
    labels: List[str]

class EmailListResponse(BaseModel):
    emails: List[dict]
    total: int
    next_page_token: Optional[str] = None

class LabelResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    name: str
    color: str
    description: str
    is_system: bool
    email_count: int

class StatsResponse(BaseModel):
    total: int
    unread: int
    sent: int = 0
    categories: dict

class AddWorkDomainRequest(BaseModel):
    domain: str

class AddPersonalContactRequest(BaseModel):
    email: str


# ============== User Auth Endpoints ==============

def get_current_user(session_id: Optional[str] = Cookie(None), db: Session = Depends(get_db)) -> Optional[User]:
    """Get current user from session"""
    if not session_id or session_id not in sessions:
        return None
    user_id = sessions[session_id]
    return db.query(User).filter(User.id == user_id).first()


@router.post("/auth/register")
async def register(request: RegisterRequest, response: Response, req: Request, db: Session = Depends(get_db)):
    """Register a new user - Secure with validation and rate limiting"""
    # SECURITY: Rate limiting for registration - prevent spam accounts
    # 3 registrations per 15 minutes per IP
    client_ip = req.client.host if req.client else "unknown"
    register_key = f"register_{client_ip}"

    now = time()
    rate_limit_store[register_key] = [
        t for t in rate_limit_store.get(register_key, [])
        if now - t < 900  # 15 minute window
    ]

    if len(rate_limit_store[register_key]) >= 3:
        raise HTTPException(
            status_code=429,
            detail="Too many registration attempts. Please try again in 15 minutes."
        )

    # Record registration attempt
    rate_limit_store[register_key].append(now)

    # Input validation
    if not request.email or not request.email.strip():
        raise HTTPException(status_code=400, detail="Email is required")

    # SECURITY: Validate email format more strictly
    email = request.email.lower().strip()
    if '@' not in email or len(email) > 254:
        raise HTTPException(status_code=400, detail="Invalid email format")

    # SECURITY: Block common disposable/temporary email domains
    disposable_domains = [
        'tempmail.com', 'throwaway.email', '10minutemail.com', 'guerrillamail.com',
        'mailinator.com', 'maildrop.cc', 'temp-mail.org', 'getnada.com',
        'trashmail.com', 'yopmail.com', 'fakeinbox.com', 'sharklasers.com'
    ]
    email_domain = email.split('@')[1] if '@' in email else ''
    if email_domain in disposable_domains:
        raise HTTPException(status_code=400, detail="Temporary email addresses are not allowed")

    if not request.password or len(request.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    # SECURITY: Password strength validation
    if request.password.isdigit() or request.password.isalpha():
        raise HTTPException(status_code=400, detail="Password must contain both letters and numbers")

    if not request.name or not request.name.strip() or len(request.name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Name must be at least 2 characters")

    # Sanitize name (prevent XSS)
    name = request.name.strip()[:100]  # Limit length
    # Remove any HTML/script tags from name
    import re
    name = re.sub(r'<[^>]*>', '', name)

    # Check if email exists
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        email=email,  # Already sanitized and validated above
        name=name,
        password_hash=User.hash_password(request.password),
        auth_provider="local"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Create secure session
    session_id = secrets.token_urlsafe(32)
    sessions[session_id] = user.id
    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=True,
        samesite="lax",
        secure=True,  # HTTPS enabled on production domain
        max_age=86400*7
    )
    
    return {"success": True, "user": user.to_dict()}


@router.post("/auth/login")
async def login(request: LoginRequest, response: Response, req: Request, db: Session = Depends(get_db)):
    """Login with email and password - Secure with rate limiting"""
    # Rate limiting: 5 attempts per 5 minutes per IP
    client_ip = req.client.host if req.client else "unknown"
    login_key = f"login_{client_ip}"

    now = time()
    rate_limit_store[login_key] = [
        t for t in rate_limit_store.get(login_key, [])
        if now - t < 300  # 5 minute window
    ]

    if len(rate_limit_store[login_key]) >= 5:
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts. Please try again in 5 minutes."
        )

    # Input validation
    if not request.email or not request.email.strip():
        raise HTTPException(status_code=400, detail="Email is required")

    if not request.password:
        raise HTTPException(status_code=400, detail="Password is required")

    user = db.query(User).filter(User.email == request.email.lower().strip()).first()

    # Record attempt BEFORE checking password (to prevent timing attacks)
    rate_limit_store[login_key].append(now)

    if not user or not user.verify_password(request.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Create secure session
    session_id = secrets.token_urlsafe(32)
    sessions[session_id] = user.id
    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=True,
        samesite="lax",
        secure=True,  # HTTPS enabled on production domain
        max_age=86400*7
    )
    
    return {"success": True, "user": user.to_dict()}


@router.get("/auth/me")
async def get_me(session_id: Optional[str] = Cookie(None), db: Session = Depends(get_db)):
    """Get current user info"""
    user = get_current_user(session_id, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"user": user.to_dict()}


@router.get("/auth/status", response_model=AuthStatusResponse)
async def get_auth_status(session_id: Optional[str] = Cookie(None), db: Session = Depends(get_db)):
    """Check if user is authenticated - SESSION-BASED ONLY (SECURE)"""
    # SECURITY: Only check session-based authentication
    # DO NOT use global gmail_service.is_authenticated() as it's shared across all users!
    user = get_current_user(session_id, db)
    if user:
        return AuthStatusResponse(
            authenticated=True,
            email=user.email,
            name=user.name,
            user_id=user.id
        )

    # Not authenticated - no valid session
    return AuthStatusResponse(authenticated=False)


@router.get("/auth/url", response_model=AuthUrlResponse)
async def get_auth_url(redirect_uri: str = Query(...)):
    """Get Gmail OAuth2 authorization URL"""
    try:
        auth_url = gmail_service.get_auth_url(redirect_uri)
        return AuthUrlResponse(auth_url=auth_url)
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/auth/callback")
async def auth_callback(request: AuthCallbackRequest, response: Response, db: Session = Depends(get_db)):
    """Handle OAuth2 callback and complete authentication"""
    try:
        success = gmail_service.authenticate(request.code, request.redirect_uri)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to authenticate with Gmail")
        
        # Verify authentication worked by checking if we can get profile
        # Note: We just called authenticate() above, so credentials should be set
        
        # Get Gmail profile
        profile = gmail_service.get_user_profile()
        gmail_email = profile.get("email") if profile else None
        
        if not gmail_email:
            raise HTTPException(status_code=400, detail="Failed to get Gmail profile")
        
        # Find or create user for this Gmail account
        user = db.query(User).filter(User.email == gmail_email).first()
        if not user:
            # Create new user for Gmail account
            user = User(
                email=gmail_email,
                name=profile.get("name", gmail_email.split("@")[0]),
                auth_provider="google",
                password_hash=None  # OAuth users don't have passwords
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        
        # Create session
        session_id = secrets.token_urlsafe(32)
        sessions[session_id] = user.id
        response.set_cookie(
            key="session_id",
            value=session_id,
            httponly=True,
            samesite="lax",
            secure=True,  # HTTPS enabled on production domain
            max_age=86400*7
        )
        
        return {
            "success": True,
            "message": "Authentication successful",
            "user": user.to_dict()
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Auth callback error: {e}")
        raise HTTPException(status_code=400, detail=f"Authentication failed: {str(e)}")


@router.post("/auth/logout")
async def logout(response: Response, session_id: Optional[str] = Cookie(None)):
    """Logout and clear credentials"""
    # Clear local session
    if session_id and session_id in sessions:
        del sessions[session_id]
    response.delete_cookie("session_id")
    
    # Clear Gmail auth
    gmail_service.logout()
    return {"success": True, "message": "Logged out successfully"}


@router.get("/users/local")
async def get_local_users(
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Get list of local users (for email composition)"""
    user = get_current_user(session_id, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Get all local users (excluding current user)
    local_users = db.query(User).filter(
        User.auth_provider == "local",
        User.is_active == True,
        User.id != user.id
    ).all()
    
    return {
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "name": u.name
            }
            for u in local_users
        ]
    }


# ============== Email Endpoints ==============

@router.get("/emails", response_model=EmailListResponse)
async def get_emails(
    category: Optional[str] = None,
    search: Optional[str] = None,
    demo: bool = False,  # Flag to get demo emails
    page_token: Optional[str] = None,
    limit: int = Query(200, ge=1, le=500),
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Get emails - demo emails for demo mode, user emails for authenticated users"""
    
    # Get current user - SECURITY: Session-based only!
    user = get_current_user(session_id, db)

    # Build base query
    query = db.query(Email)
    
    if demo:
        # Demo mode: show demo emails only
        query = query.filter(Email.is_demo == True)
    elif user:
        # Authenticated user: show their emails (local + Gmail)
        # Handle "sent" category separately
        if category == "sent":
            # Show sent emails (is_sent=True) - no category filter for sent
            query = query.filter(
                Email.user_id == user.id,
                Email.is_sent == True
            )
        elif user.auth_provider == "local":
            # Local users: show local emails only (exclude sent)
            query = query.filter(
                Email.user_id == user.id,
                Email.is_local == True,
                Email.is_sent == False  # Exclude sent emails from inbox
            )
        else:
            # Google OAuth users: show Gmail emails (exclude sent)
            query = query.filter(
                Email.user_id == user.id,
                Email.is_local == False,
                Email.is_sent == False  # Exclude sent emails from inbox
            )
            
            # Check if we need to sync from Gmail
            # SECURITY: Only sync for Google auth users
            user_email_count = query.count()
            if user_email_count == 0 and user.auth_provider == "google":
                await sync_emails_from_gmail(db, limit, user.id)
                query = db.query(Email).filter(
                    Email.user_id == user.id,
                    Email.is_local == False,
                    Email.is_sent == False
                )
    else:
        # No auth, no demo - show demo emails as fallback
        query = query.filter(Email.is_demo == True)
    
    # Apply category filter (only if not "sent" category)
    if category and category != "all" and category != "sent":
        query = query.filter(Email.predicted_category == category)
    
    # Apply search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Email.subject.ilike(search_term)) |
            (Email.sender.ilike(search_term)) |
            (Email.snippet.ilike(search_term))
        )
    
    # Order by date
    query = query.order_by(Email.received_at.desc())
    
    # Get total count
    total = query.count()
    
    # Get emails
    emails = query.limit(limit).all()
    
    return EmailListResponse(
        emails=[email.to_dict() for email in emails],
        total=total,
        next_page_token=page_token
    )



# ============== Advanced Search Endpoint ==============

@router.get("/emails/search")
async def advanced_search(
    q: Optional[str] = None,  # Full-text search
    sender: Optional[str] = None,
    subject: Optional[str] = None,
    has_attachment: Optional[bool] = None,
    is_starred: Optional[bool] = None,
    is_read: Optional[bool] = None,
    category: Optional[str] = None,
    date_from: Optional[str] = None,  # ISO date string
    date_to: Optional[str] = None,  # ISO date string
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Advanced email search with multiple filters"""
    user = get_current_user(session_id, db)

    # Build base query
    query = db.query(Email)

    if user:
        query = query.filter(Email.user_id == user.id)
    else:
        query = query.filter(Email.is_demo == True)

    # Full-text search
    if q:
        search_term = f"%{q}%"
        query = query.filter(
            (Email.subject.ilike(search_term)) |
            (Email.sender.ilike(search_term)) |
            (Email.sender_name.ilike(search_term)) |
            (Email.body.ilike(search_term)) |
            (Email.snippet.ilike(search_term))
        )

    # Sender filter
    if sender:
        sender_term = f"%{sender}%"
        query = query.filter(
            (Email.sender.ilike(sender_term)) |
            (Email.sender_name.ilike(sender_term))
        )

    # Subject filter
    if subject:
        query = query.filter(Email.subject.ilike(f"%{subject}%"))

    # Has attachment filter
    if has_attachment is not None:
        query = query.filter(Email.has_attachments == has_attachment)

    # Starred filter
    if is_starred is not None:
        query = query.filter(Email.is_starred == is_starred)

    # Read filter
    if is_read is not None:
        query = query.filter(Email.is_read == is_read)

    # Category filter
    if category:
        query = query.filter(Email.predicted_category == category)

    # Date range filter
    if date_from:
        try:
            from_date = datetime.fromisoformat(date_from.replace("Z", "+00:00"))
            query = query.filter(Email.received_at >= from_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_from format")

    if date_to:
        try:
            to_date = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
            query = query.filter(Email.received_at <= to_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_to format")

    # Get total count
    total = query.count()

    # Order and paginate
    query = query.order_by(Email.received_at.desc())
    emails = query.offset(offset).limit(limit).all()

    return {
        "emails": [email.to_dict() for email in emails],
        "total": total,
        "limit": limit,
        "offset": offset
    }


# ============== Draft Endpoints ==============

class DraftRequest(BaseModel):
    to: Optional[str] = ""
    cc: Optional[str] = ""
    bcc: Optional[str] = ""
    subject: str = ""
    body: str = ""
    reply_to_email_id: Optional[int] = None


@router.get("/emails/{email_id}")
async def get_email(
    email_id: int,
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Get single email by ID - SECURE: requires auth and ownership check"""
    # Get current user
    user = get_current_user(session_id, db)

    email = db.query(Email).filter(Email.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    # Security: Verify user owns the email
    # Demo emails can be viewed by anyone, user emails require ownership
    if not email.is_demo:
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        if email.user_id != user.id:
            raise HTTPException(status_code=403, detail="Access denied")

    return email.to_dict()


@router.post("/emails/sync")
async def sync_emails(
    limit: int = Query(200, ge=1, le=500),
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Sync emails from Gmail (only for Google OAuth users)"""
    # SECURITY: Session-based authentication only
    user = get_current_user(session_id, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Local users don't need Gmail sync
    if user.auth_provider == "local":
        return {"success": True, "synced_count": 0, "message": "Local users don't sync from Gmail"}

    # Only Google OAuth users can sync
    if user.auth_provider != "google":
        raise HTTPException(status_code=403, detail="Only Google OAuth users can sync from Gmail")
    
    user_id = user.id if user else None
    
    count = await sync_emails_from_gmail(db, limit, user_id)
    return {"success": True, "synced_count": count}


async def sync_emails_from_gmail(db: Session, limit: int = 200, user_id: Optional[int] = None) -> int:
    """Helper function to sync emails from Gmail for a specific user.

    Uses batch embedding to classify multiple emails with fewer API calls.
    This reduces Gemini API calls from N to ceil(N/20) + 1 (for category init).
    """
    result = gmail_service.fetch_emails(max_results=limit)
    emails_data = result.get("emails", [])

    # Filter out already existing emails
    new_emails = []
    for email_data in emails_data:
        existing = db.query(Email).filter(
            Email.gmail_id == email_data["gmail_id"],
            Email.user_id == user_id
        ).first()

        if not existing:
            new_emails.append(email_data)

    if not new_emails:
        return 0

    print(f"Classifying {len(new_emails)} new emails with batch embedding...")

    # Prepare emails for batch classification
    emails_for_classification = [
        {
            "subject": email_data.get("subject", ""),
            "sender": email_data.get("sender", ""),
            "content": email_data.get("body", ""),
            "sender_name": email_data.get("sender_name", "")
        }
        for email_data in new_emails
    ]

    # Batch classify all emails (uses batch embedding internally)
    classifier = get_classifier()
    classifications = classifier.classify_batch(emails_for_classification)

    synced_count = 0

    for email_data, classification in zip(new_emails, classifications):
        # Parse received_at
        received_at = datetime.fromisoformat(
            email_data.get("received_at", datetime.utcnow().isoformat()).replace("Z", "+00:00")
        )

        # Create email record with user association
        email = Email(
            user_id=user_id,
            gmail_id=email_data["gmail_id"],
            thread_id=email_data.get("thread_id"),
            is_demo=False,
            subject=email_data.get("subject", ""),
            sender=email_data.get("sender", ""),
            sender_name=email_data.get("sender_name", ""),
            recipient=email_data.get("recipient", ""),
            snippet=email_data.get("snippet", ""),
            body=email_data.get("body", ""),
            received_at=received_at,
            is_read=email_data.get("is_read", False),
            predicted_category=classification.category,
            confidence_score=classification.confidence,
        )

        # Add labels (avoid duplicates)
        added_labels = set()
        for label_name in classification.labels:
            if label_name not in added_labels:
                label = db.query(Label).filter(Label.name == label_name).first()
                if label:
                    email.labels.append(label)
                    added_labels.add(label_name)

        db.add(email)
        synced_count += 1

    db.commit()
    print(f"Successfully synced {synced_count} emails!")
    return synced_count


@router.patch("/emails/{email_id}/read")
async def mark_email_read(
    email_id: int,
    is_read: bool = True,
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Mark email as read/unread - Secure with user validation"""
    # Get current user
    user = get_current_user(session_id, db)
    
    # Find email and ensure user owns it
    email = db.query(Email).filter(Email.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    # Security: Ensure user owns the email (unless it's demo)
    if not email.is_demo and user and email.user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    email.is_read = is_read
    db.commit()

    # Also update in Gmail (only for Google OAuth users)
    if user and user.auth_provider == "google" and email.gmail_id:
        if is_read:
            gmail_service.mark_as_read(email.gmail_id)
        else:
            gmail_service.mark_as_unread(email.gmail_id)
    
    return {"success": True}


@router.patch("/emails/{email_id}/star")
async def star_email(
    email_id: int,
    is_starred: bool = True,
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Star/unstar email - Secure with user validation"""
    # Get current user
    user = get_current_user(session_id, db)
    
    # Find email and ensure user owns it
    email = db.query(Email).filter(Email.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    # Security: Ensure user owns the email (unless it's demo)
    if not email.is_demo and user and email.user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    email.is_starred = is_starred
    db.commit()

    # Also update in Gmail (only for Google OAuth users)
    if user and user.auth_provider == "google" and email.gmail_id:
        gmail_service.star_email(email.gmail_id, is_starred)
    
    return {"success": True}


@router.patch("/emails/{email_id}/category")
async def update_email_category(
    email_id: int,
    category: str,
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Update email category - Secure with user validation"""
    # Get current user
    user = get_current_user(session_id, db)
    
    # Validate category
    valid_categories = ["work", "personal", "social", "promotions", "updates", "finance", "newsletters", "primary"]
    if category not in valid_categories:
        raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of: {', '.join(valid_categories)}")
    
    # Find email and ensure user owns it
    email = db.query(Email).filter(Email.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    # Security: Ensure user owns the email (unless it's demo)
    if not email.is_demo and user and email.user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    email.predicted_category = category
    db.commit()
    
    return {"success": True}


@router.delete("/emails/{email_id}")
async def delete_email(
    email_id: int,
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Delete an email - Secure with user validation"""
    # Get current user
    user = get_current_user(session_id, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find email and ensure user owns it
    email = db.query(Email).filter(Email.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    # Security: Ensure user owns the email (unless it's demo)
    if not email.is_demo and email.user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Delete email labels associations first
    email.labels.clear()

    # Delete from Gmail if it's a Gmail email (only for Google OAuth users)
    if user.auth_provider == "google" and email.gmail_id:
        try:
            gmail_service.delete_email(email.gmail_id)
        except Exception as e:
            print(f"Error deleting email from Gmail: {e}")
            # Continue with local deletion even if Gmail deletion fails
    
    # Delete the email
    db.delete(email)
    db.commit()
    
    return {"success": True, "message": "Email deleted successfully"}


# XSS Protection: Allowed HTML tags and attributes for email body
ALLOWED_TAGS = [
    'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'a', 'img', 'div', 'span', 'blockquote', 'pre', 'code',
    'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr'
]

ALLOWED_ATTRIBUTES = {
    'a': ['href', 'title', 'target'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    'div': ['style'],
    'span': ['style'],
    'p': ['style'],
    'table': ['style', 'border', 'cellpadding', 'cellspacing'],
    'td': ['style', 'colspan', 'rowspan'],
    'th': ['style', 'colspan', 'rowspan'],
}

ALLOWED_STYLES = [
    'color', 'background-color', 'font-size', 'font-family', 'font-weight',
    'text-align', 'text-decoration', 'margin', 'padding', 'border', 'width', 'height'
]

css_sanitizer = CSSSanitizer(allowed_css_properties=ALLOWED_STYLES)

def sanitize_html(html_content: str) -> str:
    """Sanitize HTML content to prevent XSS attacks"""
    if not html_content:
        return ""
    
    # Clean HTML with bleach
    cleaned = bleach.clean(
        html_content,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        css_sanitizer=css_sanitizer,
        strip=True  # Strip disallowed tags instead of escaping
    )
    
    return cleaned

def sanitize_text(text: str) -> str:
    """Sanitize plain text to prevent XSS attacks"""
    if not text:
        return ""
    
    # Remove any HTML tags and encode special characters
    cleaned = bleach.clean(text, tags=[], strip=True)
    return cleaned


class SendEmailRequest(BaseModel):
    to: EmailStr
    subject: str
    body: str
    reply_to_email_id: Optional[int] = None
    
    @validator('subject')
    def validate_subject(cls, v):
        if not v or not v.strip():
            raise ValueError('Subject cannot be empty')
        if len(v.strip()) > 500:
            raise ValueError('Subject cannot exceed 500 characters')
        
        # XSS protection: Remove HTML tags and dangerous patterns
        cleaned = sanitize_text(v)
        
        # Additional checks for dangerous patterns
        dangerous_patterns = [
            r'<script[^>]*>.*?</script>',
            r'javascript:',
            r'on\w+\s*=',
            r'data:text/html',
            r'vbscript:',
            r'<iframe',
            r'<object',
            r'<embed',
        ]
        
        for pattern in dangerous_patterns:
            if re.search(pattern, cleaned, re.IGNORECASE | re.DOTALL):
                raise ValueError('Subject contains invalid or dangerous content')
        
        return cleaned
    
    @validator('body')
    def validate_body(cls, v):
        if not v or not v.strip():
            raise ValueError('Body cannot be empty')
        if len(v.strip()) > 50000:
            raise ValueError('Body cannot exceed 50000 characters')
        
        # Check if content contains HTML
        has_html = re.search(r'<[a-z][\s\S]*>', v, re.IGNORECASE)
        
        if has_html:
            # Sanitize HTML content
            cleaned = sanitize_html(v)
            
            # Additional check: ensure no dangerous patterns remain
            dangerous_patterns = [
                r'<script[^>]*>.*?</script>',
                r'javascript:',
                r'on\w+\s*=',
                r'data:text/html',
                r'vbscript:',
                r'<iframe',
                r'<object',
                r'<embed',
            ]
            
            for pattern in dangerous_patterns:
                if re.search(pattern, cleaned, re.IGNORECASE | re.DOTALL):
                    raise ValueError('Body contains invalid or dangerous content')
            
            return cleaned
        else:
            # Plain text: just sanitize
            return sanitize_text(v)
    
    @validator('to')
    def validate_email(cls, v):
        if not v or not v.strip():
            raise ValueError('Email cannot be empty')
        # Email format validation
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, v.strip().lower()):
            raise ValueError('Invalid email format')
        return v.strip().lower()

@router.post("/emails/send")
async def send_email(
    request: SendEmailRequest,
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Send an email - Supports both Gmail API and Local email system"""
    # Get current user
    user = get_current_user(session_id, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if user is active
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    
    # Rate limiting: 10 emails per minute per user
    now = time()
    user_key = f"user_{user.id}"
    rate_limit_store[user_key] = [
        t for t in rate_limit_store.get(user_key, [])
        if now - t < 60
    ]
    
    if len(rate_limit_store[user_key]) >= 10:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Maximum 10 emails per minute."
        )
    
    # Check if recipient is a local user
    recipient_user = db.query(User).filter(User.email == request.to.lower()).first()
    is_local_email = recipient_user is not None and recipient_user.auth_provider == "local"
    
    # If local user and sender is also local, use local email system
    if is_local_email and user.auth_provider == "local":
        # Local email system: Save to database
        try:
            # Get reply-to email if replying
            reply_to_email = None
            if request.reply_to_email_id:
                reply_to_email = db.query(Email).filter(
                    Email.id == request.reply_to_email_id,
                    Email.user_id == user.id
                ).first()
                if not reply_to_email:
                    raise HTTPException(status_code=404, detail="Email not found")
            
            # Classify the email
            classification = get_classifier().classify(
                subject=request.subject,
                sender=user.email,
                content=request.body,
                sender_name=user.name
            )
            
            # Create snippet from body
            snippet = request.body[:150].replace('\n', ' ') if request.body else ""
            
            # Create email record for recipient (Inbox)
            recipient_email = Email(
                user_id=recipient_user.id,  # Recipient
                sender_user_id=user.id,  # Sender
                is_local=True,
                is_demo=False,
                is_sent=False,  # This is received email
                subject=request.subject,
                sender=user.email,
                sender_name=user.name,
                recipient=request.to,
                snippet=snippet,
                body=request.body,
                received_at=datetime.utcnow(),
                is_read=False,
                predicted_category=classification.category,
                confidence_score=classification.confidence,
            )
            
            db.add(recipient_email)
            
            # Add labels to recipient email
            for label_name in classification.labels:
                label = db.query(Label).filter(Label.name == label_name).first()
                if label:
                    recipient_email.labels.append(label)
            
            # Create email record for sender (Sent folder)
            sent_email = Email(
                user_id=user.id,  # Sender (owner)
                sender_user_id=user.id,  # Sender
                is_local=True,
                is_demo=False,
                is_sent=True,  # This is sent email
                subject=request.subject,
                sender=user.email,
                sender_name=user.name,
                recipient=request.to,
                snippet=snippet,
                body=request.body,
                received_at=datetime.utcnow(),  # Sent time
                is_read=True,  # Sent emails are marked as read by default
                predicted_category="personal",  # Sent emails default to personal
                confidence_score=50,
            )
            
            db.add(sent_email)
            
            # Add labels to sent email
            for label_name in classification.labels:
                label = db.query(Label).filter(Label.name == label_name).first()
                if label:
                    sent_email.labels.append(label)
            
            db.commit()
            db.refresh(recipient_email)
            db.refresh(sent_email)
            
            # Record successful send for rate limiting
            rate_limit_store[user_key].append(now)
            
            return {"success": True, "message_id": f"local_{recipient_email.id}", "is_local": True}
            
        except HTTPException:
            raise
        except Exception as e:
            print(f"Error sending local email: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail="Failed to send email. Please try again later.")
    
    # Otherwise, use Gmail API (for Google OAuth users or external emails)
    # SECURITY: Check user's auth provider instead of global Gmail state
    if user.auth_provider == "local":
        raise HTTPException(
            status_code=400,
            detail=f"Recipient '{request.to}' is not a registered user. Local users can only send emails to other registered users."
        )

    if user.auth_provider != "google":
        raise HTTPException(status_code=403, detail="Only Google OAuth users can send external emails")
    
    # Get reply-to message ID if replying
    reply_to_message_id = None
    if request.reply_to_email_id:
        # Security: Ensure user owns the email they're replying to
        email = db.query(Email).filter(
            Email.id == request.reply_to_email_id,
            Email.user_id == user.id
        ).first()
        if not email:
            raise HTTPException(status_code=404, detail="Email not found")
        if email.gmail_id:
            reply_to_message_id = email.gmail_id
    
    # Send email via Gmail API
    try:
        message_id = gmail_service.send_email(
            to=request.to,
            subject=request.subject,
            body=request.body,
            reply_to_message_id=reply_to_message_id
        )
        
        if not message_id:
            raise HTTPException(status_code=500, detail="Failed to send email")
        
        # Create sent email record for sender (Sent folder)
        try:
            snippet = request.body[:150].replace('\n', ' ') if request.body else ""
            
            sent_email = Email(
                user_id=user.id,  # Sender (owner)
                sender_user_id=user.id,  # Sender
                gmail_id=message_id,  # Gmail message ID
                is_local=False,
                is_demo=False,
                is_sent=True,  # This is sent email
                subject=request.subject,
                sender=user.email,
                sender_name=user.name,
                recipient=request.to,
                snippet=snippet,
                body=request.body,
                received_at=datetime.utcnow(),  # Sent time
                is_read=True,  # Sent emails are marked as read by default
                predicted_category="personal",  # Sent emails default to personal
                confidence_score=50,
            )
            
            db.add(sent_email)
            db.commit()
            db.refresh(sent_email)
        except Exception as e:
            print(f"Warning: Could not save sent email record: {e}")
            # Don't fail the send if we can't save the sent record
        
        # Record successful send for rate limiting
        rate_limit_store[user_key].append(now)
        
        return {"success": True, "message_id": message_id, "is_local": False}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error sending email: {e}")
        raise HTTPException(status_code=500, detail="Failed to send email. Please try again later.")


# ============== Labels Endpoints ==============

@router.get("/labels", response_model=List[LabelResponse])
async def get_labels(
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Get all labels (system + user's custom labels)"""
    user = get_current_user(session_id, db)

    # Get system labels
    system_labels = db.query(Label).filter(Label.is_system == True).all()

    # Get user's custom labels if authenticated
    user_labels = []
    if user:
        user_labels = db.query(Label).filter(
            Label.user_id == user.id,
            Label.is_system == False
        ).all()

    all_labels = system_labels + user_labels
    return [LabelResponse(**label.to_dict()) for label in all_labels]


@router.post("/labels/init")
async def init_labels(db: Session = Depends(get_db)):
    """Initialize default labels"""
    for label_data in DEFAULT_LABELS:
        existing = db.query(Label).filter(
            Label.name == label_data["name"],
            Label.is_system == True
        ).first()
        if not existing:
            label = Label(**label_data)
            db.add(label)
    db.commit()
    return {"success": True, "message": "Labels initialized"}


class CreateLabelRequest(BaseModel):
    name: str
    color: str = "#6B7280"
    description: str = ""


@router.post("/labels")
async def create_label(
    request: CreateLabelRequest,
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Create a custom label for the user"""
    user = get_current_user(session_id, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Check if label with same name already exists for this user
    existing = db.query(Label).filter(
        Label.name == request.name.lower().strip(),
        (Label.user_id == user.id) | (Label.is_system == True)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Label with this name already exists")

    # Validate color format
    if not re.match(r'^#[0-9A-Fa-f]{6}$', request.color):
        raise HTTPException(status_code=400, detail="Invalid color format. Use hex format like #FF5733")

    label = Label(
        user_id=user.id,
        name=request.name.lower().strip(),
        color=request.color,
        description=request.description.strip()[:255],
        is_system=False
    )
    db.add(label)
    db.commit()
    db.refresh(label)

    return {"success": True, "label": label.to_dict()}


@router.put("/labels/{label_id}")
async def update_label(
    label_id: int,
    request: CreateLabelRequest,
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Update a custom label"""
    user = get_current_user(session_id, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    label = db.query(Label).filter(Label.id == label_id).first()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")

    if label.is_system:
        raise HTTPException(status_code=403, detail="Cannot edit system labels")

    if label.user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Validate color format
    if not re.match(r'^#[0-9A-Fa-f]{6}$', request.color):
        raise HTTPException(status_code=400, detail="Invalid color format")

    label.name = request.name.lower().strip()
    label.color = request.color
    label.description = request.description.strip()[:255]
    db.commit()

    return {"success": True, "label": label.to_dict()}


@router.delete("/labels/{label_id}")
async def delete_label(
    label_id: int,
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Delete a custom label"""
    user = get_current_user(session_id, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    label = db.query(Label).filter(Label.id == label_id).first()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")

    if label.is_system:
        raise HTTPException(status_code=403, detail="Cannot delete system labels")

    if label.user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Remove label from all emails
    label.emails.clear()
    db.delete(label)
    db.commit()

    return {"success": True, "message": "Label deleted"}


# ============== Threaded Emails Endpoint ==============

@router.get("/emails/threads")
async def get_threaded_emails(
    category: Optional[str] = None,
    search: Optional[str] = None,
    demo: bool = False,
    limit: int = Query(100, ge=1, le=500),
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Get emails grouped by thread (conversation view)"""
    user = get_current_user(session_id, db)

    # Build base query
    query = db.query(Email)

    if demo:
        query = query.filter(Email.is_demo == True)
    elif user:
        query = query.filter(Email.user_id == user.id, Email.is_draft == False)
    else:
        query = query.filter(Email.is_demo == True)

    # Apply category filter
    if category and category != "all":
        if category == "sent":
            query = query.filter(Email.is_sent == True)
        elif category == "important":
            query = query.filter(Email.is_starred == True)
        else:
            query = query.filter(Email.predicted_category == category)

    # Apply search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Email.subject.ilike(search_term)) |
            (Email.sender.ilike(search_term)) |
            (Email.body.ilike(search_term))
        )

    # Order by date
    query = query.order_by(Email.received_at.desc())

    # Get all matching emails
    emails = query.all()

    # Group by thread_id
    threads = {}
    for email in emails:
        # Use thread_id or create one from subject
        thread_key = email.thread_id or f"subject_{email.subject}"
        if thread_key not in threads:
            threads[thread_key] = {
                "thread_id": thread_key,
                "emails": [],
                "subject": email.subject,
                "latest_date": email.received_at,
                "participants": set(),
                "unread_count": 0,
                "is_starred": False,
                "predicted_category": email.predicted_category,
            }
        threads[thread_key]["emails"].append(email.to_dict())
        threads[thread_key]["participants"].add(email.sender)
        if not email.is_read:
            threads[thread_key]["unread_count"] += 1
        if email.is_starred:
            threads[thread_key]["is_starred"] = True
        if email.received_at > threads[thread_key]["latest_date"]:
            threads[thread_key]["latest_date"] = email.received_at

    # Convert to list and format
    thread_list = []
    for thread_key, thread_data in threads.items():
        thread_list.append({
            "thread_id": thread_data["thread_id"],
            "subject": thread_data["subject"],
            "email_count": len(thread_data["emails"]),
            "emails": sorted(thread_data["emails"], key=lambda x: x["received_at"]),
            "participants": list(thread_data["participants"]),
            "unread_count": thread_data["unread_count"],
            "is_starred": thread_data["is_starred"],
            "latest_date": thread_data["latest_date"].isoformat(),
            "predicted_category": thread_data["predicted_category"],
        })

    # Sort by latest date
    thread_list.sort(key=lambda x: x["latest_date"], reverse=True)

    return {
        "threads": thread_list[:limit],
        "total": len(thread_list)
    }


# ============== Bulk Actions Endpoints ==============

class BulkActionRequest(BaseModel):
    email_ids: List[int]
    action: str  # delete, archive, mark_read, mark_unread, star, unstar, move_category
    category: Optional[str] = None  # For move_category action


@router.post("/emails/bulk")
async def bulk_email_action(
    request: BulkActionRequest,
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Perform bulk actions on multiple emails"""
    user = get_current_user(session_id, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if not request.email_ids:
        raise HTTPException(status_code=400, detail="No emails specified")

    if len(request.email_ids) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 emails per bulk action")

    # Verify user owns all emails
    emails = db.query(Email).filter(
        Email.id.in_(request.email_ids),
        (Email.user_id == user.id) | (Email.is_demo == True)
    ).all()

    if len(emails) != len(request.email_ids):
        raise HTTPException(status_code=403, detail="Access denied to some emails")

    affected = 0

    if request.action == "delete":
        for email in emails:
            email.labels.clear()
            db.delete(email)
            affected += 1

    elif request.action == "archive":
        for email in emails:
            email.is_archived = True
            affected += 1

    elif request.action == "mark_read":
        for email in emails:
            email.is_read = True
            affected += 1

    elif request.action == "mark_unread":
        for email in emails:
            email.is_read = False
            affected += 1

    elif request.action == "star":
        for email in emails:
            email.is_starred = True
            affected += 1

    elif request.action == "unstar":
        for email in emails:
            email.is_starred = False
            affected += 1

    elif request.action == "move_category":
        if not request.category:
            raise HTTPException(status_code=400, detail="Category is required for move_category action")
        valid_categories = ["primary", "work", "personal", "social", "promotions", "updates", "finance", "newsletters"]
        if request.category not in valid_categories:
            raise HTTPException(status_code=400, detail=f"Invalid category")

        for email in emails:
            # Store for AI learning
            if email.predicted_category != request.category:
                feedback = AIFeedback(
                    user_id=user.id,
                    email_id=email.id,
                    original_category=email.predicted_category,
                    corrected_category=request.category,
                    subject=email.subject,
                    sender=email.sender,
                    sender_domain=email.sender.split("@")[1] if "@" in email.sender else ""
                )
                db.add(feedback)
                email.user_category = request.category
            email.predicted_category = request.category
            affected += 1
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {request.action}")

    db.commit()
    return {"success": True, "affected": affected}


@router.post("/drafts")
async def save_draft(
    request: DraftRequest,
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Save a new draft"""
    user = get_current_user(session_id, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    draft = Email(
        user_id=user.id,
        sender_user_id=user.id,
        is_local=True,
        is_demo=False,
        is_sent=False,
        is_draft=True,
        subject=request.subject,
        sender=user.email,
        sender_name=user.name,
        recipient=request.to or "",
        cc=request.cc or "",
        bcc=request.bcc or "",
        snippet=request.body[:150] if request.body else "",
        body=request.body,
        received_at=datetime.utcnow(),
        is_read=True,
        predicted_category="primary",
    )

    db.add(draft)
    db.commit()
    db.refresh(draft)

    return {"success": True, "draft": draft.to_dict()}


@router.put("/drafts/{draft_id}")
async def update_draft(
    draft_id: int,
    request: DraftRequest,
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Update an existing draft"""
    user = get_current_user(session_id, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    draft = db.query(Email).filter(
        Email.id == draft_id,
        Email.user_id == user.id,
        Email.is_draft == True
    ).first()

    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    draft.recipient = request.to or ""
    draft.cc = request.cc or ""
    draft.bcc = request.bcc or ""
    draft.subject = request.subject
    draft.body = request.body
    draft.snippet = request.body[:150] if request.body else ""
    draft.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(draft)

    return {"success": True, "draft": draft.to_dict()}


@router.get("/drafts")
async def get_drafts(
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Get all drafts for the current user"""
    user = get_current_user(session_id, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    drafts = db.query(Email).filter(
        Email.user_id == user.id,
        Email.is_draft == True
    ).order_by(Email.updated_at.desc()).all()

    return {"drafts": [draft.to_dict() for draft in drafts]}


@router.delete("/drafts/{draft_id}")
async def delete_draft(
    draft_id: int,
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Delete a draft"""
    user = get_current_user(session_id, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    draft = db.query(Email).filter(
        Email.id == draft_id,
        Email.user_id == user.id,
        Email.is_draft == True
    ).first()

    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    db.delete(draft)
    db.commit()

    return {"success": True, "message": "Draft deleted"}


# ============== AI Feedback Endpoint ==============

class CategoryFeedbackRequest(BaseModel):
    email_id: int
    corrected_category: str


@router.post("/ai/feedback")
async def submit_category_feedback(
    request: CategoryFeedbackRequest,
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Submit feedback when user corrects email category - for AI learning"""
    user = get_current_user(session_id, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    email = db.query(Email).filter(
        Email.id == request.email_id,
        (Email.user_id == user.id) | (Email.is_demo == True)
    ).first()

    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    valid_categories = ["primary", "work", "personal", "social", "promotions", "updates", "finance", "newsletters"]
    if request.corrected_category not in valid_categories:
        raise HTTPException(status_code=400, detail="Invalid category")

    # Create feedback record for AI learning
    feedback = AIFeedback(
        user_id=user.id,
        email_id=email.id,
        original_category=email.predicted_category,
        corrected_category=request.corrected_category,
        subject=email.subject,
        sender=email.sender,
        sender_domain=email.sender.split("@")[1] if "@" in email.sender else ""
    )
    db.add(feedback)

    # Update email category
    email.user_category = request.corrected_category
    email.predicted_category = request.corrected_category

    db.commit()

    return {
        "success": True,
        "message": "Feedback recorded. AI will learn from this correction.",
        "original_category": feedback.original_category,
        "new_category": request.corrected_category
    }


@router.get("/ai/feedback/stats")
async def get_feedback_stats(
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Get statistics about user's category corrections"""
    user = get_current_user(session_id, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    total_feedback = db.query(AIFeedback).filter(AIFeedback.user_id == user.id).count()

    # Get most corrected categories
    from sqlalchemy import func
    corrections = db.query(
        AIFeedback.original_category,
        AIFeedback.corrected_category,
        func.count(AIFeedback.id).label('count')
    ).filter(
        AIFeedback.user_id == user.id
    ).group_by(
        AIFeedback.original_category,
        AIFeedback.corrected_category
    ).order_by(func.count(AIFeedback.id).desc()).limit(10).all()

    # Get most corrected senders
    sender_corrections = db.query(
        AIFeedback.sender_domain,
        AIFeedback.corrected_category,
        func.count(AIFeedback.id).label('count')
    ).filter(
        AIFeedback.user_id == user.id,
        AIFeedback.sender_domain != ""
    ).group_by(
        AIFeedback.sender_domain,
        AIFeedback.corrected_category
    ).order_by(func.count(AIFeedback.id).desc()).limit(10).all()

    return {
        "total_corrections": total_feedback,
        "category_corrections": [
            {"from": c.original_category, "to": c.corrected_category, "count": c.count}
            for c in corrections
        ],
        "sender_patterns": [
            {"domain": s.sender_domain, "preferred_category": s.corrected_category, "count": s.count}
            for s in sender_corrections
        ]
    }


# ============== Attachment Endpoints ==============

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB max file size
ALLOWED_EXTENSIONS = {'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.png', '.jpg', '.jpeg', '.gif', '.zip'}


@router.post("/attachments/upload")
async def upload_attachment(
    file: UploadFile = File(...),
    email_id: Optional[int] = Form(None),
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Upload an attachment"""
    user = get_current_user(session_id, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Validate file extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")

    # Read file content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"File too large. Max size: {MAX_FILE_SIZE // (1024*1024)}MB")

    # Generate unique filename
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    # Save file
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)

    # Create attachment record
    attachment = Attachment(
        email_id=email_id,
        filename=file.filename,
        content_type=file.content_type or 'application/octet-stream',
        size=len(content),
        storage_path=unique_filename
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    return {
        "success": True,
        "attachment": {
            "id": attachment.id,
            "filename": attachment.filename,
            "content_type": attachment.content_type,
            "size": attachment.size
        }
    }


@router.get("/attachments/{attachment_id}")
async def get_attachment(
    attachment_id: int,
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Get attachment metadata"""
    user = get_current_user(session_id, db)

    attachment = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    return {
        "id": attachment.id,
        "filename": attachment.filename,
        "content_type": attachment.content_type,
        "size": attachment.size,
        "created_at": attachment.created_at.isoformat() if attachment.created_at else None
    }


@router.get("/attachments/{attachment_id}/download")
async def download_attachment(
    attachment_id: int,
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Download an attachment file"""
    user = get_current_user(session_id, db)

    attachment = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    file_path = os.path.join(UPLOAD_DIR, attachment.storage_path)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    async with aiofiles.open(file_path, 'rb') as f:
        content = await f.read()

    return Response(
        content=content,
        media_type=attachment.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{attachment.filename}"'
        }
    )


@router.delete("/attachments/{attachment_id}")
async def delete_attachment(
    attachment_id: int,
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Delete an attachment"""
    user = get_current_user(session_id, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    attachment = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    # Delete file from disk
    file_path = os.path.join(UPLOAD_DIR, attachment.storage_path)
    if os.path.exists(file_path):
        os.remove(file_path)

    # Delete record
    db.delete(attachment)
    db.commit()

    return {"success": True, "message": "Attachment deleted"}


# ============== Stats Endpoints ==============

@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Get email statistics"""
    # Get current user
    user = get_current_user(session_id, db)
    
    if user:
        # User-specific stats
        base_query = db.query(Email).filter(Email.user_id == user.id)
        total = base_query.filter(Email.is_sent == False).count()  # Exclude sent from total
        unread = base_query.filter(Email.is_read == False, Email.is_sent == False).count()
        sent = base_query.filter(Email.is_sent == True).count()
        
        # Category counts (exclude sent emails)
        categories = {}
        for category in ["primary", "work", "personal", "social", "promotions", "updates", "finance", "newsletters"]:
            count = base_query.filter(
                Email.predicted_category == category,
                Email.is_sent == False
            ).count()
            categories[category] = count
    else:
        # Global stats (for demo or unauthenticated)
        total = db.query(Email).filter(Email.is_sent == False).count()
        unread = db.query(Email).filter(Email.is_read == False, Email.is_sent == False).count()
        sent = db.query(Email).filter(Email.is_sent == True).count()
        
        categories = {}
        for category in ["primary", "work", "personal", "social", "promotions", "updates", "finance", "newsletters"]:
            count = db.query(Email).filter(
                Email.predicted_category == category,
                Email.is_sent == False
            ).count()
            categories[category] = count
    
    return StatsResponse(
        total=total,
        unread=unread,
        sent=sent,
        categories=categories
    )


# ============== Settings Endpoints ==============
# Note: Work domain and personal contact endpoints removed
# The semantic classifier uses embedding-based classification
# and doesn't require manual domain/contact configuration


# ============== Demo Endpoints ==============

# Import demo emails from separate file
from demo_emails import DEMO_EMAILS


@router.post("/emails/demo")
async def load_demo_emails(db: Session = Depends(get_db)):
    """Load demo emails for testing - only for demo mode users"""
    from datetime import timedelta, timezone
    import random
    from sqlalchemy import text
    
    # Check if demo emails already exist
    existing_demo = db.query(Email).filter(Email.is_demo == True).count()
    if existing_demo >= len(DEMO_EMAILS):
        return {"success": True, "synced_count": existing_demo, "message": "Demo emails already loaded"}
    
    # Clear existing demo emails only
    try:
        demo_email_ids = [e.id for e in db.query(Email).filter(Email.is_demo == True).all()]
        if demo_email_ids:
            db.execute(text(f"DELETE FROM email_labels WHERE email_id IN ({','.join(map(str, demo_email_ids))})"))
            db.query(Email).filter(Email.is_demo == True).delete()
            db.commit()
    except Exception:
        db.rollback()
    
    synced_count = 0
    base_time = datetime.now(timezone.utc)
    
    for i, email_data in enumerate(DEMO_EMAILS):
        # Classify the email
        classification = get_classifier().classify(
            subject=email_data.get("subject", ""),
            sender=email_data.get("sender", ""),
            content=email_data.get("body", ""),
            sender_name=email_data.get("sender_name", "")
        )
        
        # Create demo email
        email = Email(
            user_id=None,  # Demo emails don't belong to a specific user
            gmail_id=f"demo_{email_data['gmail_id']}",
            thread_id=f"thread_demo_{email_data['gmail_id']}",
            is_demo=True,  # Mark as demo
            subject=email_data.get("subject", ""),
            sender=email_data.get("sender", ""),
            sender_name=email_data.get("sender_name", ""),
            recipient="demo@smartinbox.app",
            snippet=email_data.get("snippet", ""),
            body=email_data.get("body", ""),
            received_at=base_time.replace(tzinfo=None) - timedelta(hours=i * 2 + random.randint(0, 5)),
            is_read=email_data.get("is_read", False),
            predicted_category=classification.category,
            confidence_score=classification.confidence,
        )
        
        # Add labels
        added_labels = set()
        for label_name in classification.labels:
            if label_name not in added_labels:
                label = db.query(Label).filter(Label.name == label_name).first()
                if label:
                    email.labels.append(label)
                    added_labels.add(label_name)
        
        db.add(email)
        synced_count += 1
    
    db.commit()
    return {"success": True, "synced_count": synced_count, "message": "Demo emails loaded"}


# ============== Database Init ==============

@router.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    init_db()

