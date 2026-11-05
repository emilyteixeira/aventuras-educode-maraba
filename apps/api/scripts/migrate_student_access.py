"""Preflight por padrão. Aplicar com --apply somente após backup verificado."""

import argparse
import asyncio
import json

from app import db
from app.migrations import migrate_student_access


async def main(apply: bool) -> None:
    db.init_engine()
    try:
        result = await migrate_student_access(db.get_engine(), apply=apply)
        print(json.dumps(result))
    finally:
        await db.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    asyncio.run(main(args.apply))
