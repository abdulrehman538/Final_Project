import re

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email as django_validate_email
from rest_framework import serializers

PHONE_PATTERN = re.compile(r"^0\d{10}$")
PHONE_INVALID_MSG = "Phone must be 11 digits and start with 0 (e.g. 03001234567)."
EMAIL_INVALID_MSG = "Enter a valid email address."


def normalize_phone(value):
    if value is None:
        return ""
    return re.sub(r"\D", "", str(value).strip())


def clean_pk_phone(value, required=False):
    normalized = normalize_phone(value)
    if not normalized:
        if required:
            raise serializers.ValidationError("Phone number is required.")
        return ""
    if not PHONE_PATTERN.match(normalized):
        raise serializers.ValidationError(PHONE_INVALID_MSG)
    return normalized


def clean_email(value, required=False):
    cleaned = (value or "").strip()
    if not cleaned:
        if required:
            raise serializers.ValidationError("Email is required.")
        return ""
    try:
        django_validate_email(cleaned)
    except DjangoValidationError:
        raise serializers.ValidationError(EMAIL_INVALID_MSG)
    return cleaned
