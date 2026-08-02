from functools import lru_cache

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    app_name: str = Field(default="MonteCarlo API", alias="APP_NAME")
    app_version: str = Field(default="0.1.0", alias="APP_VERSION")
    environment: str = Field(default="development", alias="ENVIRONMENT")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    database_url: str = Field(
        default="postgresql+asyncpg://montecarlo:montecarlo@localhost:5432/montecarlo",
        alias="DATABASE_URL",
    )
    cors_origins: str = Field(default="http://localhost:3000", alias="CORS_ORIGINS")
    seed_demo_data: bool = Field(default=True, alias="SEED_DEMO_DATA")
    mt5_api_key: SecretStr | None = Field(default=None, alias="MT5_API_KEY")
    mt5_heartbeat_timeout_seconds: int = Field(
        default=90, ge=10, le=3600, alias="MT5_HEARTBEAT_TIMEOUT_SECONDS"
    )

    @field_validator("mt5_api_key")
    @classmethod
    def validate_mt5_api_key(cls, value: SecretStr | None) -> SecretStr | None:
        if value is not None and len(value.get_secret_value()) < 32:
            raise ValueError("MT5_API_KEY must contain at least 32 characters")
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
