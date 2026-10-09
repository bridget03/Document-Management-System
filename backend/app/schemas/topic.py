from pydantic import BaseModel, field_validator

UnitStatus = ("ACTIVE", "INACTIVE")


class TopicIn(BaseModel):
    name: str
    status: str = "ACTIVE"

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("must not be empty")
        if len(v) > 255:
            raise ValueError("tên vấn đề tối đa 255 ký tự")
        return v

    @field_validator("status")
    @classmethod
    def _check_status(cls, v: str) -> str:
        v = (v or "ACTIVE").upper()
        if v not in UnitStatus:
            raise ValueError("status phải là ACTIVE hoặc INACTIVE")
        return v


class TopicOut(BaseModel):
    id: str
    name: str
    status: str

    class Config:
        from_attributes = True
