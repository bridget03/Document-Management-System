from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_ENV: str = "development"
    DATABASE_URL: str = "postgresql://dms:dms@localhost:5432/dms"
    JWT_SECRET: str = "change-me-in-production"
    JWT_EXPIRE_MINUTES: int = 60
    STORAGE_PATH: str = "./storage"
    MAX_FILE_SIZE_MB: int = 100
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/google-drive/callback"
    GOOGLE_SCOPES: str = "https://www.googleapis.com/auth/drive.readonly"
    DRIVE_TOKEN_KEY: str = ""  # Fernet key (generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
    SYNC_INTERVAL_MINUTES: int = 30
    CORS_ORIGINS: str = "http://localhost:5173"

    ALGORITHM: str = "HS256"

    class Config:
        env_file = ".env"

    @property
    def max_file_size_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
