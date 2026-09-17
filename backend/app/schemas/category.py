from pydantic import BaseModel


class CategoryCreate(BaseModel):
    name: str
    description: str | None = None


class CategoryOut(BaseModel):
    id: str
    name: str
    description: str | None = None

    class Config:
        from_attributes = True
