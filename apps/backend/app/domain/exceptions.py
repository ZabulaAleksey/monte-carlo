class DomainError(Exception):
    """Base error that is safe to expose through the API."""

    code = "domain_error"
    status_code = 400


class NotFoundError(DomainError):
    code = "not_found"
    status_code = 404


class ConflictError(DomainError):
    code = "conflict"
    status_code = 409


class SynchronizationError(DomainError):
    code = "synchronization_error"
    status_code = 503
