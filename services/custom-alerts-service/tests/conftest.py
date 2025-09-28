import sys
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app import db
from app.main import app


@pytest.fixture()
def test_engine() -> Generator:
    engine = create_engine(
        "sqlite://",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    db.Base.metadata.create_all(bind=engine)
    try:
        yield engine
    finally:
        db.Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture()
def session_local(test_engine):
    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=test_engine,
        future=True,
    )
    original_session_local = db.SessionLocal
    original_engine = db.engine
    db.SessionLocal = TestingSessionLocal  # type: ignore[assignment]
    db.engine = test_engine  # type: ignore[assignment]
    try:
        yield TestingSessionLocal
    finally:
        db.SessionLocal = original_session_local  # type: ignore[assignment]
        db.engine = original_engine  # type: ignore[assignment]


@pytest.fixture()
def db_session(session_local: sessionmaker) -> Generator[Session, None, None]:
    session = session_local()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(session_local: sessionmaker) -> Generator[TestClient, None, None]:
    def _get_test_session() -> Generator[Session, None, None]:
        db_ = session_local()
        try:
            yield db_
        finally:
            db_.close()

    app.dependency_overrides.setdefault(db.get_session, _get_test_session)
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(db.get_session, None)
