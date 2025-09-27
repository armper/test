from typing import Generator

from ..db.session import get_db


def get_db_session() -> Generator:
    yield from get_db()
