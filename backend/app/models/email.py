from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Table
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


# Many-to-many relationship table
EmailLabel = Table(
    'email_labels',
    Base.metadata,
    Column('email_id', Integer, ForeignKey('emails.id'), primary_key=True),
    Column('label_id', Integer, ForeignKey('labels.id'), primary_key=True)
)


class Email(Base):
    __tablename__ = "emails"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), index=True, nullable=True)  # Owner user (recipient)
    sender_user_id = Column(Integer, ForeignKey('users.id'), index=True, nullable=True)  # Sender user (for local emails)
    gmail_id = Column(String(255), index=True)  # Gmail message ID (not unique - per user)
    thread_id = Column(String(255), index=True)  # Gmail thread ID
    is_demo = Column(Boolean, default=False)  # Demo emails flag
    is_local = Column(Boolean, default=False)  # Local email flag (internal messaging)
    is_draft = Column(Boolean, default=False)  # Draft email flag

    subject = Column(String(500), default="")
    sender = Column(String(255), index=True)
    sender_name = Column(String(255), default="")
    recipient = Column(String(255))
    cc = Column(Text, default="")  # CC recipients (comma-separated)
    bcc = Column(Text, default="")  # BCC recipients (comma-separated)

    snippet = Column(Text, default="")  # Preview text
    body = Column(Text, default="")  # Full email body

    # Attachment support
    has_attachments = Column(Boolean, default=False)
    attachments_json = Column(Text, default="[]")  # JSON array of attachment metadata

    received_at = Column(DateTime, default=datetime.utcnow, index=True)
    is_read = Column(Boolean, default=False)
    is_starred = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    is_sent = Column(Boolean, default=False)  # Sent folder flag

    # Classification results
    predicted_category = Column(String(50), default="inbox")  # Primary category
    confidence_score = Column(Integer, default=0)  # 0-100
    user_category = Column(String(50), nullable=True)  # User-corrected category (for AI learning)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    labels = relationship("Label", secondary=EmailLabel, back_populates="emails")
    
    def to_dict(self):
        import json
        return {
            "id": self.id,
            "user_id": self.user_id,
            "sender_user_id": self.sender_user_id,
            "gmail_id": self.gmail_id,
            "thread_id": self.thread_id,
            "is_demo": self.is_demo,
            "is_local": self.is_local,
            "is_draft": self.is_draft,
            "subject": self.subject,
            "sender": self.sender,
            "sender_name": self.sender_name,
            "recipient": self.recipient,
            "cc": self.cc,
            "bcc": self.bcc,
            "snippet": self.snippet,
            "body": self.body,
            "has_attachments": self.has_attachments,
            "attachments": json.loads(self.attachments_json) if self.attachments_json else [],
            "received_at": self.received_at.isoformat() if self.received_at else None,
            "is_read": self.is_read,
            "is_starred": self.is_starred,
            "is_archived": self.is_archived,
            "is_sent": self.is_sent,
            "predicted_category": self.predicted_category,
            "confidence_score": self.confidence_score,
            "user_category": self.user_category,
            "labels": [label.name for label in self.labels],
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Label(Base):
    __tablename__ = "labels"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), index=True, nullable=True)  # Null for system labels
    name = Column(String(100), index=True)
    color = Column(String(7), default="#6B7280")  # Hex color
    description = Column(String(255), default="")
    is_system = Column(Boolean, default=False)  # System labels can't be deleted

    # Relationships
    emails = relationship("Email", secondary=EmailLabel, back_populates="labels")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "color": self.color,
            "description": self.description,
            "is_system": self.is_system,
            "email_count": len(self.emails)
        }


# AI Feedback model for learning from user corrections
class AIFeedback(Base):
    __tablename__ = "ai_feedback"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), index=True)
    email_id = Column(Integer, ForeignKey('emails.id'), index=True)
    original_category = Column(String(50))
    corrected_category = Column(String(50))
    subject = Column(String(500), default="")
    sender = Column(String(255), default="")
    sender_domain = Column(String(255), default="")
    created_at = Column(DateTime, default=datetime.utcnow)


# Attachment model for file storage
class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    email_id = Column(Integer, ForeignKey('emails.id'), index=True)
    filename = Column(String(255))
    content_type = Column(String(100))
    size = Column(Integer)  # File size in bytes
    storage_path = Column(String(500))  # Path to stored file
    gmail_attachment_id = Column(String(255), nullable=True)  # Gmail attachment ID
    created_at = Column(DateTime, default=datetime.utcnow)


# Default system labels
DEFAULT_LABELS = [
    {"name": "primary", "color": "#3B82F6", "description": "Primary inbox", "is_system": True},
    {"name": "work", "color": "#EF4444", "description": "Work and business emails", "is_system": True},
    {"name": "personal", "color": "#10B981", "description": "Personal emails", "is_system": True},
    {"name": "social", "color": "#8B5CF6", "description": "Social media notifications", "is_system": True},
    {"name": "promotions", "color": "#F59E0B", "description": "Marketing and promotional emails", "is_system": True},
    {"name": "updates", "color": "#0891B2", "description": "Updates and notifications", "is_system": True},
    {"name": "finance", "color": "#059669", "description": "Financial and banking emails", "is_system": True},
    {"name": "newsletters", "color": "#7C3AED", "description": "Newsletter subscriptions", "is_system": True},
]

