import asyncio
import logging

logging.basicConfig(level=logging.INFO)


async def main() -> None:
    logging.info("Push worker placeholder running - awaiting Kafka integration")
    while True:
        await asyncio.sleep(60)


if __name__ == "__main__":
    asyncio.run(main())
