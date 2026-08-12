from __future__ import annotations
from typing import Any, Dict, Optional


class DomainException(Exception):
    """Base exception class for all domain and business logic errors."""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class ResourceNotFoundError(DomainException):
    """Raised when a requested database entity or resource is not found."""

    pass


class DuplicateResourceError(DomainException):
    """Raised when an operation would create a duplicate unique entity."""

    pass


class ValidationError(DomainException):
    """Raised when domain rule validation fails."""

    pass


class ExternalAPIError(DomainException):
    """Raised when an external service integration (Meta API, HTTP client) fails."""

    pass


class UnauthorizedError(DomainException):
    """Raised when authorization or authentication checks fail."""

    pass


class PermissionError(UnauthorizedError):
    """Raised when permission check fails."""

    pass


NotFoundError = ResourceNotFoundError

