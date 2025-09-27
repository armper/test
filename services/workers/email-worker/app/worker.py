import asyncio
import logging
import os

logging.basicConfig(level=logging.INFO)


async def main() -> None:
    logging.info("Email worker placeholder running - awaiting Kafka integration")
    while True:
        await asyncio.sleep(60)


if __name__ == "__main__":
    asyncio.run(main())
