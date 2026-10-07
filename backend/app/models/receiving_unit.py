import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, String

from app.database.database import Base


class ReceivingUnit(Base):
    """Danh mục đơn vị tiếp nhận cho công văn đến (dropdown "Đơn vị tiếp nhận").

    Lưu tên dạng text ở CorrespondenceDocument.signer (không FK) để dữ liệu
    cũ nhập tự do vẫn tương thích, giống cách Department làm.
    """

    __tablename__ = "receiving_units"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False, unique=True, index=True)
    status = Column(String(20), nullable=False, default="ACTIVE")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


# Don vi mac dinh (17 don vi thanh vien), seed khi khoi dong neu chua co.
DEFAULT_RECEIVING_UNITS = [
    "Tổng Công ty đầu tư phát triển Đô Thị - CTCP",
    "Công ty cổ phần đầu tư phát triển Vicenza",
    "Công ty TNHH khai thác và chế biến khoáng sản liên doanh Việt Nhật",
    "Công ty cổ phần tập đoàn Westminster Việt Nam",
    "Công ty cổ phần tập đoàn tư vấn xây dựng Kensington Việt Nam",
    "Công ty cổ phần tập đoàn Sentosa Việt Nam",
    "Công ty cổ phần tập đoàn Phúc Thành Invest",
    "Công ty cổ phần tập đoàn Phúc Thịnh Invest",
    "Công ty cổ phần tập đoàn Greenwich Việt Nam",
    "Công ty cổ phần tập đoàn McCarthy Việt Nam",
    "Công ty cổ phần tập đoàn CasaAmini Việt Nam",
    "Công ty cổ phần tập đoàn đầu tư Đại Phúc Hưng Việt Nam",
    "Công ty cổ phần tập đoàn xây dựng Notting Hill Gate Việt Nam",
    "Công ty cổ phần tập đoàn landcaster Việt Nam",
    "Nhà máy gạch men cao cấp Vicenza",
    "Công ty cổ phần tập đoàn AMANI KINGDOM CAPITAL",
    "Công ty cổ phần tập đoàn công nghiệp Kingplace",
]
