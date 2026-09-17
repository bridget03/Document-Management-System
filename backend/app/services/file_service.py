from abc import ABC, abstractmethod
from datetime import datetime
import os
import uuid


class StorageProvider(ABC):
    @abstractmethod
    def save(self, data: bytes, extension: str) -> str:
        ...

    @abstractmethod
    def get(self, path: str) -> bytes:
        ...

    @abstractmethod
    def delete(self, path: str) -> None:
        ...

    @abstractmethod
    def exists(self, path: str) -> bool:
        ...


class LocalStorageProvider(StorageProvider):
    def __init__(self, base_path: str):
        self.base_path = base_path

    def _dated_dir(self) -> str:
        now = datetime.now()
        d = os.path.join(self.base_path, "documents", str(now.year), f"{now.month:02d}")
        os.makedirs(d, exist_ok=True)
        return d

    def save(self, data: bytes, extension: str) -> str:
        ext = f".{extension.lower()}" if extension else ""
        filename = f"{uuid.uuid4()}{ext}"
        directory = self._dated_dir()
        full = os.path.join(directory, filename)
        with open(full, "wb") as f:
            f.write(data)
        return os.path.relpath(full, self.base_path)

    def get(self, path: str) -> bytes:
        full = os.path.join(self.base_path, path)
        with open(full, "rb") as f:
            return f.read()

    def full_path(self, path: str) -> str:
        return os.path.join(self.base_path, path)

    def delete(self, path: str) -> None:
        full = os.path.join(self.base_path, path)
        if os.path.exists(full):
            os.remove(full)

    def exists(self, path: str) -> bool:
        return os.path.exists(os.path.join(self.base_path, path))
