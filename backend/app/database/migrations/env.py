from alembic import context
from app.database.database import Base, engine
import app.models  # noqa: F401

context.configure(connection=engine.connect(), target_metadata=Base.metadata)

with context.begin_transaction():
    context.run_migrations()
