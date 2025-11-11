#!/usr/bin/env python3


import json
import logging
import os
import sys
import time
import datetime
from typing import Optional, List, Dict, Any, Generator

from atproto import FirehoseSubscribeReposClient, parse_subscribe_repos_message, models, CAR
from atproto_client.models import utils as models_utils
from confluent_kafka import Producer


# 1. Logging Configuration



logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("BlueskyProducerV2_4")


# 2. Application Configuration


class Config:
    """Holds all static configuration for the application."""
    
    def __init__(self):
        self.KAFKA_BROKER: str = os.getenv("KAFKA_BROKER", "10.0.0.10:9092")
        self.KAFKA_TOPIC: str = os.getenv("KAFKA_TOPIC", "tweets")
        
        self.BLUESKY_SOURCE_NAME: str = "bluesky"
        self.HEARTBEAT_INTERVAL: int = 5000  # Log a heartbeat every N events
        
        # Bluesky AT Protocol Namespace IDs (NSIDs)
        self.POST_TYPE_NSID: str = "app.bsky.feed.post"
        self.MENTION_TYPE_NSID: str = "app.bsky.richtext.facet#mention"
        self.RECORD_EMBED_NSID: str = "app.bsky.embed.record"
        
        log.info(f"KAFKA_BROKER set to: {self.KAFKA_BROKER}")
        log.info(f"KAFKA_TOPIC set to: {self.KAFKA_TOPIC}")



# 3. Bluesky Producer Class


class BlueskyProducer:
    """
    Connects to the Bluesky firehose, transforms posts, 
    and produces them to a Kafka topic.
    """
    
    def __init__(self):
        """Initializes configuration, Kafka producer, and Bluesky client."""
        self.config = Config()
        self.producer = self._init_kafka_producer()
        self.client = FirehoseSubscribeReposClient()
        self.event_counter = 0
        log.info(f"BlueskyProducer initialized. Producing to topic '{self.config.KAFKA_TOPIC}'.")

    def _init_kafka_producer(self) -> Producer:
        """Initializes and returns a Confluent Kafka Producer."""
        try:
            producer_conf = {'bootstrap.servers': self.config.KAFKA_BROKER}
            producer = Producer(producer_conf)
            log.info(f"Successfully connected to Kafka at {self.config.KAFKA_BROKER}")
            return producer
        except Exception as e:
            log.error(f"FATAL: Failed to connect to Kafka: {e}")
            sys.exit(1)

    def _delivery_report(self, err, msg):
        """Callback for Kafka produce events."""
        if err is not None:
            log.warning(f"Message delivery failed: {err}")

    def _get_timestamp_ms(self, record: models.ComAtprotoSyncSubscribeRepos.Commit) -> int:
        """
        Extracts the post's creation time in milliseconds.
        Returns a valid, positive millisecond timestamp.
        """
        created_at_str = getattr(record, 'createdAt', None)
        
        # 1. Check for invalid string input
        if not created_at_str or not str(created_at_str).strip():
            log.warning("No 'createdAt' field found or field is empty. Defaulting to current time.")
            return int(time.time() * 1000)
            
        try:
            # 2. Parse the timestamp
            dt = datetime.datetime.fromisoformat(str(created_at_str).replace('Z', '+00:00'))
            timestamp_ms = int(dt.timestamp() * 1000)
            
            
            # 3. Check for invalid values (e.g., 0, negative, or before 2023)
            # 
            if timestamp_ms < 1672531200000:
                log.warning(f"Parsed an invalid or epoch timestamp ({created_at_str}). Defaulting to current time.")
                return int(time.time() * 1000)
                
            return timestamp_ms
            
        except (TypeError, ValueError) as e:
            log.warning(f"Could not parse timestamp '{created_at_str}': {e}. Defaulting to current time.")
            return int(time.time() * 1000)

    def _extract_mentions(self, record: models.ComAtprotoSyncSubscribeRepos.Commit) -> str:
        """Extracts mention DIDs into a comma-separated string."""
        mentions_list: List[str] = []
        facets = getattr(record, 'facets', None)
        if not facets:
            return ""
            
        for facet in facets:
            features = getattr(facet, 'features', [])
            for feature in features:
                if getattr(feature, 'py_type', None) == self.config.MENTION_TYPE_NSID:
                    mention_did = getattr(feature, 'did', None)
                    if mention_did:
                        mentions_list.append(mention_did)
                        
        return ",".join(mentions_list)

    def _extract_repost_uri(self, record: models.ComAtprotoSyncSubscribeRepos.Commit) -> Optional[str]:
        """Extracts the URI of a quote-post (embedded record)."""
        embed_data = getattr(record, 'embed', None)
        if (embed_data and 
            getattr(embed_data, 'py_type', None) == self.config.RECORD_EMBED_NSID):
            
            embedded_record = getattr(embed_data, 'record', None)
            if embedded_record:
                return getattr(embedded_record, 'uri', None)
        return None

    def _transform_post(self, record_data: dict, commit: models.ComAtprotoSyncSubscribeRepos.Commit, op_path: str) -> Optional[Dict[str, Any]]:
        """
        Transforms a raw Bluesky post record into our standardized dictionary.
        Returns None if the post is invalid or not a text post.
        """
        record = models_utils.get_or_create(record_data, strict=False)
        if not record:
            return None

        post_text = getattr(record, 'text', None)
        if not post_text:
            return None

        reply_data = getattr(record, 'reply', None)
        
        
        return {
            "id": f"at://{commit.repo}/{op_path}",
            "author_did": commit.repo,
            "author_handle": None, 
            "text": post_text,
            "timestamp": self._get_timestamp_ms(record),
            "source": self.config.BLUESKY_SOURCE_NAME,
            "mentions": self._extract_mentions(record),
            "reply_to_uri": getattr(reply_data.parent, 'uri', None) if reply_data else None,
            "repost_of_uri": self._extract_repost_uri(record)
        }

    def _produce_to_kafka(self, post: Dict[str, Any]):
        """Serializes and produces a standardized post to Kafka."""
        try:
            output_json = json.dumps(post).encode('utf-8')
            
            self.producer.produce(
                self.config.KAFKA_TOPIC,
                value=output_json,
                key=post["id"].encode('utf-8'),
                callback=self._delivery_report
            )
            
            log.info(f"Produced: {post['text'][:120].replace(os.linesep, ' ')}...")
            
        except json.JSONDecodeError:
            log.error(f"Failed to serialize post with ID: {post.get('id')}")
        except Exception as e:
            log.error(f"Error during Kafka production: {e}")

    def _process_commit(self, commit: models.ComAtprotoSyncSubscribeRepos.Commit) -> None:
        """Processes a single commit, extracting and producing any new posts."""
        try:
            car = CAR.from_bytes(commit.blocks)
        except Exception as e:
            log.warning(f"Failed to parse CAR file for commit {commit.repo}: {e}")
            return

        for op in commit.ops:
            if op.action == 'create' and op.path.startswith(self.config.POST_TYPE_NSID):
                
                record_data = car.blocks.get(op.cid)
                if not record_data:
                    continue
                
                standardized_post = self._transform_post(record_data, commit, op.path)
                
                if standardized_post:
                    self._produce_to_kafka(standardized_post)
                    
    def _on_message_handler(self, message: dict) -> None:
        """
        The main callback function for the firehose.
        Parses the message and routes it for processing.
        """
        try:
            self.event_counter += 1
            if self.event_counter % self.config.HEARTBEAT_INTERVAL == 0:
                log.info(f"Heartbeat: Processed {self.event_counter} events. Still listening...")
                self.producer.poll(0)

            commit = parse_subscribe_repos_message(message)
            
            if isinstance(commit, models.ComAtprotoSyncSubscribeRepos.Commit):
                self._process_commit(commit)

            self.producer.poll(0)

        except Exception as e:
            log.error(f"Error processing firehose message: {e}", exc_info=True)

    def start(self):
        """
        Starts the main producer loop with automatic reconnection.
        """
        log.info("Starting producer loop...")
        while True:
            try:
                log.info("Connecting to Bluesky Firehose...")
                self.client.start(self._on_message_handler)
                
            except KeyboardInterrupt:
                log.info("Shutdown signal received.")
                break
            except Exception as e:
                log.error(f"Main client error: {e}. Reconnecting in 10 seconds...", exc_info=True)
                time.sleep(10)
            finally:
                log.info("Flushing Kafka producer...")
                self.producer.flush() 

        log.info("Producer loop stopped.")
        self.producer.flush()
        log.info("Kafka producer flushed. Exiting.")


# 4. Main Execution


if __name__ == "__main__":
    producer_service = BlueskyProducer()
    producer_service.start()