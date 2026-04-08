from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str
    cors_origins: list[str] = ["http://localhost:3000"]
    port: int = 8000

    class Config:
        env_file = ".env"


settings = Settings()
