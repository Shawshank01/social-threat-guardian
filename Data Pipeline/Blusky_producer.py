#!/usr/bin/env python3

import json
import logging
import os
import sys
import time
import datetime
from dataclasses import dataclass, asdict
from typing import Optional, Any, Iterator

from atproto import FirehoseSubscribeReposClient, parse_subscribe_repos_message, models, CAR
from atproto_client.models import utils as models_utils
from confluent_kafka import Producer

MIN_VALID_TIMESTAMP_MS = 1672531200000
DEFAULT_KAFKA_BROKER = "10.0.0.10:9092"
DEFAULT_KAFKA_TOPIC = "tweets"
HEARTBEAT_INTERVAL = 5000

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("BlueskyProducerV2_Refactored")

# Refactored configuaration for maintainability and readability
@dataclass
class AppConfig:
    kafka_broker: str
    kafka_topic: str
    source_name: str = "bluesky"
    post_nsid: str = "app.bsky.feed.post"
    mention_nsid: str = "app.bsky.richtext.facet#mention"
    embed_nsid: str = "app.bsky.embed.record"

    @classmethod
    def from_env(cls) -> 'AppConfig':
        return cls(
            kafka_broker=os.getenv("KAFKA_BROKER", DEFAULT_KAFKA_BROKER),
            kafka_topic=os.getenv("KAFKA_TOPIC", DEFAULT_KAFKA_TOPIC)
        )


@dataclass
class StandardizedPost:
    id: str
    author_did: str
    text: str
    timestamp: int
    source: str
    mentions: str
    reply_to_uri: Optional[str]
    repost_of_uri: Optional[str]
    author_handle: Optional[str] = None

    def to_json_bytes(self) -> bytes:
        return json.dumps(asdict(self)).encode('utf-8')

# I have this class here for parsing and extracting data from At proto
class ATProtocolTransformer:
    def __init__(self, config: AppConfig):
        self.config = config

    def extract_posts_from_commit(self, commit: models.ComAtprotoSyncSubscribeRepos.Commit) -> Iterator[StandardizedPost]:
        try:
            car = CAR.from_bytes(commit.blocks)
        except Exception as e:
            log.warning(f"Failed to parse CAR file for commit {commit.repo}: {e}")
            return

        for op in commit.ops:
            if op.action == 'create' and op.path.startswith(self.config.post_nsid):
                record_raw = car.blocks.get(op.cid)
                if not record_raw:
                    continue

                post = self._transform_record(record_raw, commit, op.path)
                if post:
                    yield post

    def _transform_record(self, record_data: dict, commit: models.ComAtprotoSyncSubscribeRepos.Commit, op_path: str) -> Optional[StandardizedPost]:
        record = models_utils.get_or_create(record_data, strict=False)
        if not record or not getattr(record, 'text', None):
            return None

        reply_ref = getattr(record, 'reply', None)

        return StandardizedPost(
            id=f"at://{commit.repo}/{op_path}",
            author_did=commit.repo,
            text=record.text,
            timestamp=self._parse_timestamp(record),
            source=self.config.source_name,
            mentions=self._extract_mentions(record),
            reply_to_uri=getattr(reply_ref.parent, 'uri', None) if reply_ref else None,
            repost_of_uri=self._extract_repost_uri(record)
        )
# Time is parsed as milliseconds
    def _parse_timestamp(self, record: Any) -> int:
        current_time_ms = int(time.time() * 1000)
        created_at = getattr(record, 'createdAt', None)

        if not created_at:
            return current_time_ms

        try:
            dt = datetime.datetime.fromisoformat(str(created_at).replace('Z', '+00:00'))
            ts_ms = int(dt.timestamp() * 1000)

            if ts_ms < MIN_VALID_TIMESTAMP_MS:
                return current_time_ms
            return ts_ms
        except (TypeError, ValueError):
            return current_time_ms

    def _extract_mentions(self, record: Any) -> str:
        mentions = []
        facets = getattr(record, 'facets', []) or []

        for facet in facets:
            for feature in getattr(facet, 'features', []):
                if getattr(feature, 'py_type', None) == self.config.mention_nsid:
                    if did := getattr(feature, 'did', None):
                        mentions.append(did)

        return ",".join(mentions)

    def _extract_repost_uri(self, record: Any) -> Optional[str]:
        embed = getattr(record, 'embed', None)
        if embed and getattr(embed, 'py_type', None) == self.config.embed_nsid:
            if embedded_record := getattr(embed, 'record', None):
                return getattr(embedded_record, 'uri', None)
        return None

# This is the main service class, the meat of the application, where everything meshes up together
class BlueskyToKafkaService:
    def __init__(self, config: AppConfig, producer: Producer, transformer: ATProtocolTransformer):
        self.config = config
        self.producer = producer
        self.transformer = transformer
        self.client = FirehoseSubscribeReposClient()
        self.event_counter = 0
# In this function, the service starts by connecting to the bluesky firehose, if it fails, automatic reconnection happens in ten seconds
    def start(self):
        log.info(f"Starting Service. Target Kafka Topic: {self.config.kafka_topic}")

        while True:
            try:
                log.info("Connecting to Bluesky Firehose...")
                self.client.start(self._handle_firehose_message)
            except KeyboardInterrupt:
                log.info("Shutdown signal received.")
                break
            except Exception as e:
                log.error(f"Firehose client error: {e}. Reconnecting in 10s...", exc_info=True)
                time.sleep(10)
            finally:
                self._flush_producer()

        self._flush_producer()
        log.info("Service exited.")
# Once we receive new data from the bluesky firehose, we parse it and send it the send to kafka function
    def _handle_firehose_message(self, message: dict) -> None:
        try:
            self._heartbeat()

            commit = parse_subscribe_repos_message(message)
            if not isinstance(commit, models.ComAtprotoSyncSubscribeRepos.Commit):
                return

            for post in self.transformer.extract_posts_from_commit(commit):
                self._send_to_kafka(post)

            self.producer.poll(0)

        except Exception as e:
            log.error(f"Error processing message: {e}", exc_info=True)

    def _send_to_kafka(self, post: StandardizedPost):
        try:
            self.producer.produce(
                self.config.kafka_topic,
                value=post.to_json_bytes(),
                key=post.id.encode('utf-8'),
                callback=self._kafka_delivery_report
            )
            log.info(f"Produced: {post.text[:60].replace(os.linesep, ' ')}...")
        except Exception as e:
            log.error(f"Kafka produce error for {post.id}: {e}")

    def _kafka_delivery_report(self, err, msg):
        if err is not None:
            log.warning(f"Message delivery failed: {err}")
# Every 5000 heartbeat events a message is logged to the console so that i can know its up and running
    def _heartbeat(self):
        self.event_counter += 1
        if self.event_counter % HEARTBEAT_INTERVAL == 0:
            log.info(f"Heartbeat: Processed {self.event_counter} events.")

    def _flush_producer(self):
        log.info("Flushing Kafka producer...")
        self.producer.flush()


def create_kafka_producer(broker_url: str) -> Producer:
    try:
        p = Producer({'bootstrap.servers': broker_url})
        log.info(f"Kafka Producer connected to {broker_url}")
        return p
    except Exception as e:
        log.critical(f"Failed to create Kafka Producer: {e}")
        sys.exit(1)


if __name__ == "__main__":
    app_config = AppConfig.from_env()
    kafka_producer = create_kafka_producer(app_config.kafka_broker)
    at_transformer = ATProtocolTransformer(app_config)

    service = BlueskyToKafkaService(
        config=app_config,
        producer=kafka_producer,
        transformer=at_transformer
    )

    service.start()