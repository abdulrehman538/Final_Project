from pathlib import Path

from django.apps import AppConfig
from django.core.exceptions import ImproperlyConfigured


class ApiConfig(AppConfig):
    name = 'api'

    def ready(self):
        from django.conf import settings

        media_root = getattr(settings, 'MEDIA_ROOT', None)
        if not media_root:
            return

        media_path = Path(media_root)
        if media_path.exists() and not media_path.is_dir():
            raise ImproperlyConfigured(
                f"MEDIA_ROOT must be a directory, but {media_path} is a file. "
                "Remove the file and restart the server."
            )

        for subdir in ('products',):
            (media_path / subdir).mkdir(parents=True, exist_ok=True)
