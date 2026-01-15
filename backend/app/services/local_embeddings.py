"""
Local Embedding Service using sentence-transformers

This provides FREE, UNLIMITED semantic embeddings without API rate limits.
Uses the all-MiniLM-L6-v2 model which is fast and accurate for email classification.
"""
import numpy as np
from typing import List, Optional
from sentence_transformers import SentenceTransformer

# Global model instance (lazy loaded)
_model: Optional[SentenceTransformer] = None


def get_model() -> SentenceTransformer:
    """Get or initialize the sentence transformer model."""
    global _model
    if _model is None:
        print("Loading local embedding model (all-MiniLM-L6-v2)...")
        # all-MiniLM-L6-v2 is fast, small (80MB), and accurate
        # Good for semantic similarity tasks like email classification
        _model = SentenceTransformer('all-MiniLM-L6-v2')
        print("Local embedding model loaded!")
    return _model


def get_embedding(text: str) -> np.ndarray:
    """Get embedding vector for a single text."""
    model = get_model()
    return model.encode(text, convert_to_numpy=True)


def get_embeddings_batch(texts: List[str], batch_size: int = 32) -> List[np.ndarray]:
    """Get embedding vectors for multiple texts efficiently.

    This is much faster than individual calls and has NO rate limits.
    Can process hundreds of emails in seconds.
    """
    if not texts:
        return []

    model = get_model()
    # batch_size controls memory usage - 32 is a good default
    embeddings = model.encode(texts, batch_size=batch_size, convert_to_numpy=True, show_progress_bar=False)
    return [emb for emb in embeddings]


def cosine_similarity(vec1: np.ndarray, vec2: np.ndarray) -> float:
    """Calculate cosine similarity between two vectors."""
    dot_product = np.dot(vec1, vec2)
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(dot_product / (norm1 * norm2))
