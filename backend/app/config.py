from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./caspian.db"
    public_origin: str = "http://localhost:8080"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    upload_dir: str = "./uploads"
    max_upload_mb: int = 12

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()

