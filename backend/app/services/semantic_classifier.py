"""
Semantic Email Classifier - Uses local sentence-transformers for FREE, UNLIMITED embeddings

This classifier uses the all-MiniLM-L6-v2 model which runs locally on the server.
No API rate limits, no costs, instant responses.
"""
import numpy as np
from typing import List, Dict, Optional
from dataclasses import dataclass
from . import local_embeddings


@dataclass
class ClassificationResult:
    category: str
    confidence: int
    labels: List[str]
    reason: str


class SemanticEmailClassifier:
    """
    Semantic email classifier using local sentence-transformers.
    Uses cosine similarity between email content and category descriptions.

    Benefits:
    - FREE: No API costs
    - UNLIMITED: No rate limits
    - FAST: ~100ms per email, batch processing even faster
    - PRIVATE: Data never leaves your server
    """

    # Category descriptions for semantic matching
    CATEGORY_DESCRIPTIONS: Dict[str, List[str]] = {
        "work": [
            "Professional work email about meetings, projects, deadlines",
            "Office communication regarding tasks, assignments, reports",
            "Business correspondence with colleagues and managers",
            "Job-related emails about interviews, recruitment, career",
            "Team collaboration on Slack, Jira, GitHub, pull requests",
            "Corporate announcements and company updates",
            "Calendar invites and meeting schedules",
        ],
        "personal": [
            "Personal email from friends and family",
            "Casual conversation about life, plans, gatherings",
            "Birthday wishes, congratulations, personal news",
            "Vacation plans, trip discussions, photo sharing",
            "Catching up with old friends, reunion planning",
            "Personal matters and family discussions",
        ],
        "social": [
            "Social media notifications from Facebook, Twitter, LinkedIn",
            "Someone liked, commented, or shared your post",
            "New follower or friend request notification",
            "Social network activity and engagement alerts",
            "Instagram, TikTok, YouTube notifications",
            "Connection requests and social updates",
        ],
        "promotions": [
            "Marketing email with sales, discounts, special offers",
            "Promotional content about deals and limited time offers",
            "E-commerce notifications about new products",
            "Coupon codes, vouchers, and promotional campaigns",
            "Black Friday, holiday sales, clearance events",
            "Shopping recommendations and product suggestions",
        ],
        "updates": [
            "Account security alerts and password notifications",
            "Service updates and system notifications",
            "Order confirmation, shipping, and delivery updates",
            "App updates and software notifications",
            "Account verification and login alerts",
            "Subscription and service status updates",
        ],
        "finance": [
            "Bank statement and financial transaction alerts",
            "Payment confirmation, invoice, and billing",
            "Credit card and banking notifications",
            "Investment updates and financial reports",
            "Tax documents and financial statements",
            "Money transfer and payment receipts",
        ],
        "newsletters": [
            "Newsletter digest and content roundup",
            "Weekly or daily news briefing",
            "Blog updates and article recommendations",
            "Industry news and curated content",
            "Substack, Medium, and publication updates",
            "Educational content and learning resources",
        ],
    }

    def __init__(self):
        # Cache for category embeddings
        self._category_embeddings: Dict[str, np.ndarray] = {}
        self._initialized = False

    def initialize_category_embeddings(self):
        """Pre-compute embeddings for all category descriptions."""
        if self._initialized:
            return

        print("Initializing category embeddings with local model...")

        # Prepare all category texts
        category_texts = []
        category_names = []
        for category, descriptions in self.CATEGORY_DESCRIPTIONS.items():
            combined_text = " ".join(descriptions)
            category_texts.append(combined_text)
            category_names.append(category)

        # Batch embed all categories at once (fast!)
        embeddings = local_embeddings.get_embeddings_batch(category_texts)

        for category, embedding in zip(category_names, embeddings):
            self._category_embeddings[category] = embedding
            print(f"  - {category}: embedded")

        self._initialized = True
        print("Category embeddings initialized!")

    def classify(self, subject: str, sender: str, content: str, sender_name: str = "") -> ClassificationResult:
        """
        Classify an email using semantic similarity.

        Args:
            subject: Email subject line
            sender: Sender email address
            content: Email body content
            sender_name: Optional sender display name

        Returns:
            ClassificationResult with category, confidence, labels, and reason
        """
        # Ensure category embeddings are initialized
        if not self._initialized:
            self.initialize_category_embeddings()

        # Prepare email text for embedding
        email_text = self._prepare_email_text(subject, sender, content, sender_name)

        # Get email embedding (instant, no API call)
        email_embedding = local_embeddings.get_embedding(email_text)

        # Calculate similarity with each category
        similarities: Dict[str, float] = {}
        for category, cat_embedding in self._category_embeddings.items():
            similarity = local_embeddings.cosine_similarity(email_embedding, cat_embedding)
            similarities[category] = similarity

        # Find best matching category
        best_category = max(similarities, key=similarities.get)
        best_similarity = similarities[best_category]

        # Convert similarity to confidence (0-100)
        # Local model similarities are typically lower, so adjust scale
        confidence = int(min(95, max(0, best_similarity * 150)))

        # If confidence is too low, default to primary
        if confidence < 30:
            best_category = "primary"
            confidence = 50

        # Get secondary labels (other high-scoring categories)
        labels = [best_category]
        for cat, sim in similarities.items():
            if cat != best_category and sim * 150 >= 40:
                labels.append(cat)

        # Build reason string
        top_3 = sorted(similarities.items(), key=lambda x: x[1], reverse=True)[:3]
        reason = "Semantic(local): " + ", ".join([f"{cat}={sim:.2f}" for cat, sim in top_3])

        return ClassificationResult(
            category=best_category,
            confidence=confidence,
            labels=list(set(labels)),
            reason=reason
        )

    def _prepare_email_text(self, subject: str, sender: str, content: str, sender_name: str = "") -> str:
        """Prepare email text for embedding by combining relevant fields."""
        parts = []

        if subject:
            parts.append(f"Subject: {subject}")

        if sender_name:
            parts.append(f"From: {sender_name}")
        elif sender:
            # Extract name from email if possible
            parts.append(f"From: {sender.split('@')[0]}")

        if content:
            # Limit content length for efficiency
            truncated_content = content[:1500]
            parts.append(f"Content: {truncated_content}")

        return "\n".join(parts)

    def classify_batch(self, emails: List[Dict], batch_size: int = 64) -> List[ClassificationResult]:
        """
        Classify multiple emails efficiently using batch embedding.

        This is MUCH faster than individual calls because:
        1. No API rate limits to worry about
        2. Local model can batch process efficiently
        3. GPU/CPU parallelization

        For 200 emails: ~2-3 seconds (vs 13+ minutes with Gemini API)

        Args:
            emails: List of dicts with 'subject', 'sender', 'content', 'sender_name' keys
            batch_size: Number of emails to embed per batch (default 64)

        Returns:
            List of ClassificationResult objects
        """
        if not emails:
            return []

        # Ensure category embeddings are initialized
        if not self._initialized:
            self.initialize_category_embeddings()

        # Prepare all email texts
        email_texts = [
            self._prepare_email_text(
                email.get("subject", ""),
                email.get("sender", ""),
                email.get("content", ""),
                email.get("sender_name", "")
            )
            for email in emails
        ]

        print(f"  Embedding {len(email_texts)} emails with local model...")

        # Get all embeddings at once (FAST - no rate limits!)
        all_embeddings = local_embeddings.get_embeddings_batch(email_texts, batch_size=batch_size)

        print(f"  Classifying {len(all_embeddings)} emails...")

        # Classify each email using its embedding
        results = []
        for email_embedding in all_embeddings:
            # Calculate similarity with each category
            similarities: Dict[str, float] = {}
            for category, cat_embedding in self._category_embeddings.items():
                similarity = local_embeddings.cosine_similarity(email_embedding, cat_embedding)
                similarities[category] = similarity

            # Find best matching category
            best_category = max(similarities, key=similarities.get)
            best_similarity = similarities[best_category]

            # Convert similarity to confidence (0-100)
            confidence = int(min(95, max(0, best_similarity * 150)))

            # If confidence is too low, default to primary
            if confidence < 30:
                best_category = "primary"
                confidence = 50

            # Get secondary labels
            labels = [best_category]
            for cat, sim in similarities.items():
                if cat != best_category and sim * 150 >= 40:
                    labels.append(cat)

            # Build reason string
            top_3 = sorted(similarities.items(), key=lambda x: x[1], reverse=True)[:3]
            reason = "Semantic(local): " + ", ".join([f"{cat}={sim:.2f}" for cat, sim in top_3])

            results.append(ClassificationResult(
                category=best_category,
                confidence=confidence,
                labels=list(set(labels)),
                reason=reason
            ))

        print(f"  Classification complete!")
        return results


# Lazy-loaded global instance
_classifier_instance: Optional[SemanticEmailClassifier] = None


def get_semantic_classifier() -> SemanticEmailClassifier:
    """Get or create the global semantic classifier instance."""
    global _classifier_instance
    if _classifier_instance is None:
        _classifier_instance = SemanticEmailClassifier()
    return _classifier_instance


# For backwards compatibility with existing code
def classify_email(subject: str, sender: str, content: str, sender_name: str = "") -> ClassificationResult:
    """Convenience function to classify a single email."""
    classifier = get_semantic_classifier()
    return classifier.classify(subject, sender, content, sender_name)
