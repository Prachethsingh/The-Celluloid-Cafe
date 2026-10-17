"""Command-line interface for running sync workers."""
import argparse
import asyncio
import logging

from .availability_sync import main as availability_sync_main
from .episode_sync import main as episode_sync_main
from .metadata_sync import main as metadata_sync_main

logger = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a sync worker")
    parser.add_argument(
        "worker",
        choices=["metadata", "availability", "episode"],
        help="Which worker to run",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")

    if args.worker == "metadata":
        asyncio.run(metadata_sync_main())
    elif args.worker == "availability":
        asyncio.run(availability_sync_main())
    elif args.worker == "episode":
        asyncio.run(episode_sync_main())
    else:
        raise ValueError(f"Unknown worker: {args.worker}")


if __name__ == "__main__":
    main()