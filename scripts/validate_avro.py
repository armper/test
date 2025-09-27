import json
import sys
from pathlib import Path

try:
    import fastavro  # type: ignore
except ImportError as exc:  # pragma: no cover
    raise SystemExit("fastavro is required to validate schemas") from exc


SCHEMA_DIR = Path(__file__).resolve().parent.parent / "schemas" / "avro"


def main() -> None:
    failures = []
    for schema_file in SCHEMA_DIR.glob("*.avsc"):
        with schema_file.open() as fh:
            data = json.load(fh)
        try:
            fastavro.parse_schema(data)
        except Exception as exc:  # pragma: no cover
            failures.append((schema_file.name, str(exc)))
    if failures:
        for name, err in failures:
            print(f"Schema {name} failed validation: {err}")
        sys.exit(1)
    print(f"Validated {len(list(SCHEMA_DIR.glob('*.avsc')))} schemas")


if __name__ == "__main__":
    main()
