"""
Mastodon Trending Posts to Kafka Producer
Fetches trending hashtags from Mastodon.social and retrieves the latest posts
from each hashtag, sending them to Kafka topic 'mastodon-raw-posts'.
"""

import os
import json
import time
import logging
import argparse
from confluent_kafka import Producer
from mastodon import Mastodon, MastodonRatelimitError
from dotenv import load_dotenv
from datetime import datetime
import sys
import signal
from pathlib import Path

# ---------------------------------------------------------------------
# Parse command-line arguments
# ---------------------------------------------------------------------
parser = argparse.ArgumentParser(description="Mastodon Trending Posts to Kafka Producer")
parser.add_argument('--dry-run', action='store_true', help='Run in dry-run mode (no messages sent to Kafka)')
parser.add_argument('--start', action='store_true', help='Start in background (daemon)')
parser.add_argument('--stop', action='store_true', help='Stop background daemon if running')
parser.add_argument('--status', action='store_true', help='Show background daemon status')
parser.add_argument('--foreground', action='store_true', help='Run in foreground until Ctrl+C')
args = parser.parse_args()

# ---------------------------------------------------------------------
# Load configuration
# ---------------------------------------------------------------------
load_dotenv()
MASTODON_INSTANCE_URL = os.getenv("MASTODON_INSTANCE_URL", "https://mastodon.social")
KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "10.0.0.10:9092")
KAFKA_TOPIC = os.getenv("KAFKA_TOPIC", "mastodon-raw-posts")
BASE_DIR = Path(__file__).resolve().parent
PID_FILE = os.getenv("PID_FILE", str(BASE_DIR / "mastodon_kafka_producer.pid"))
LOG_FILE = os.getenv("LOG_FILE", str(BASE_DIR / "mastodon_kafka_producer.log"))
STATE_FILE = os.getenv("STATE_FILE", str(BASE_DIR / "latest_post_ids.json"))

# ---------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------
def setup_logging(log_path: str | None = None):
    handlers = []
    if log_path:
        handlers.append(logging.FileHandler(log_path))
    else:
        handlers.append(logging.StreamHandler(sys.stdout))
    logging.basicConfig(
        format="%(asctime)s [%(levelname)s] %(message)s",
        level=logging.INFO,
        handlers=handlers,
    )

# ---------------------------------------------------------------------
# Mock producer for dry-run mode
# ---------------------------------------------------------------------
class MockMsg:
    def __init__(self, topic):
        self._topic = topic

    def topic(self):
        return self._topic

    def partition(self):
        return 0

    def offset(self):
        return 0

class MockProducer:
    def produce(self, topic, value, callback=None):
        logging.info(f"[Dry-run] Produce to topic '{topic}': {value.decode('utf-8')}")
        if callback:
            # Simulate successful delivery callback with proper MockMsg instance
            callback(None, MockMsg(topic))

    def poll(self, timeout):
        logging.debug("[Dry-run] Poll called")

    def flush(self):
        logging.info("[Dry-run] Flush called")

    def close(self):
        logging.info("[Dry-run] Close called")

# ---------------------------------------------------------------------
# Kafka producer or mock producer
# ---------------------------------------------------------------------
producer = None

def get_producer(dry_run: bool):
    global producer
    if producer is not None:
        return producer
    if dry_run:
        producer_local = MockProducer()
        logging.info("Dry-run mode enabled: messages will not be sent to Kafka.")
    else:
        conf = {'bootstrap.servers': KAFKA_BOOTSTRAP_SERVERS}
        producer_local = Producer(conf)
        logging.info(f"Connected to Kafka at {KAFKA_BOOTSTRAP_SERVERS}")
    producer = producer_local
    return producer

def close_producer():
    global producer
    if producer is None:
        return
    try:
        producer.flush()
    except Exception:
        pass
    try:
        producer.close()
    except Exception:
        pass
    producer = None

# ---------------------------------------------------------------------
# Mastodon client
# ---------------------------------------------------------------------
mastodon = None

def get_mastodon_client():
    global mastodon
    if mastodon is None:
        # No access_token -> unauthenticated, uses IP rate limit (~7500 req/5min)
        mastodon = Mastodon(
            api_base_url=MASTODON_INSTANCE_URL,
            ratelimit_method="pace",
        )
    return mastodon

# ---------------------------------------------------------------------
# Daemonization and PID management
# ---------------------------------------------------------------------
def read_pid(pid_file: str):
    try:
        with open(pid_file, "r") as f:
            return int(f.read().strip())
    except Exception:
        return None

def is_process_running(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False

def is_running(pid_file: str):
    pid = read_pid(pid_file)
    if pid and is_process_running(pid):
        return pid
    return None

def daemonize(pid_file: str):
    if is_running(pid_file):
        raise RuntimeError("Daemon already running.")
    pid = os.fork()
    if pid > 0:
        os._exit(0)
    os.setsid()
    pid = os.fork()
    if pid > 0:
        os._exit(0)
    # Detach stdio
    sys.stdout.flush()
    sys.stderr.flush()
    with open("/dev/null", "rb", 0) as f:
        os.dup2(f.fileno(), 0)
    with open("/dev/null", "ab", 0) as f:
        os.dup2(f.fileno(), 1)
        os.dup2(f.fileno(), 2)
    # Write PID
    with open(pid_file, "w") as f:
        f.write(str(os.getpid()))
    # Ignore SIGHUP in daemon
    signal.signal(signal.SIGHUP, signal.SIG_IGN)

def stop_daemon(pid_file: str) -> tuple[bool, str]:
    pid = read_pid(pid_file)
    if not pid:
        return False, "No PID file found."
    try:
        os.kill(pid, signal.SIGTERM)
        # Wait for process to exit
        for _ in range(100):
            if not is_process_running(pid):
                try:
                    os.remove(pid_file)
                except Exception:
                    pass
                return True, f"Stopped process {pid}."
            time.sleep(0.1)
        return False, "Timed out waiting for process to stop."
    except Exception as e:
        return False, f"Error stopping process: {e}"

# ---------------------------------------------------------------------
# Load and save state for latest post IDs per hashtag
# ---------------------------------------------------------------------
def load_state():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            logging.error(f"Failed to load state file {STATE_FILE}: {e}")
    return {}

def save_state(state):
    try:
        with open(STATE_FILE, "w") as f:
            json.dump(state, f)
    except Exception as e:
        logging.error(f"Failed to save state file {STATE_FILE}: {e}")

latest_post_ids = {}

# ---------------------------------------------------------------------
# Helper function: fetch trending tags + posts
# ---------------------------------------------------------------------
def fetch_trending_posts(limit_per_tag=20):
    try:
        mastodon = get_mastodon_client()
        tags = mastodon.trending_tags(limit=5)
        for tag in tags:
            tag_name = tag["name"]
            since_id = latest_post_ids.get(tag_name)
            logging.info(f"Fetching posts for #{tag_name} since_id={since_id}")
            posts = mastodon.timeline_hashtag(tag_name, limit=limit_per_tag, since_id=since_id)
            if not posts:
                logging.info(f"No new posts for #{tag_name}")
                continue
            max_id = since_id
            # Sort posts by ID ascending to send oldest first
            posts_sorted = sorted(posts, key=lambda p: p["id"])
            for post in posts_sorted:
                post_id_int = post["id"]
                post_id_str = str(post_id_int)
                # Only send posts with ID greater than stored max
                if since_id is not None and post_id_int <= since_id:
                    continue

                account = post.get("account", {})
                # Extract account info with defaults
                username = account.get("username")
                display_name = account.get("display_name")
                followers_count = account.get("followers_count")
                account_id = account.get("id")
                # Visibility can be public, unlisted, private, direct
                visibility = post.get("visibility")

                # Format timestamps to ISO 8601 string if datetime object
                created_at = post.get("created_at")
                if hasattr(created_at, "isoformat"):
                    created_at_str = created_at.isoformat()
                else:
                    created_at_str = str(created_at)

                import datetime as dt
                collected_at_str = dt.datetime.now(dt.timezone.utc).isoformat()

                record = {
                    "post_id": post_id_str,
                    "raw_post_id": post_id_str,
                    "platform_id": 1,
                    "hashtag": tag_name,
                    "username": username,
                    "display_name": display_name,
                    "post_content": post.get("content"),
                    "created_at": created_at_str,
                    "language": post.get("language"),
                    "url": post.get("url"),
                    "visibility": visibility,
                    "collected_at": collected_at_str,
                    "threat_level": None,
                    "contains_hate_speech": None,
                    "processed_at": None,
                    "processing_status": None,
                    # Additional metadata
                    "followers_count": followers_count,
                    "account_id": account_id,
                }

                producer = get_producer(args.dry_run)
                producer.produce(KAFKA_TOPIC, json.dumps(record).encode("utf-8"), callback=delivery_report)
                producer.poll(0)
                if max_id is None or post_id_int > max_id:
                    max_id = post_id_int
            latest_post_ids[tag_name] = max_id
            save_state(latest_post_ids)
            time.sleep(1)  # brief pause per hashtag
    except MastodonRatelimitError:
        logging.warning("Rate limit hit — sleeping for 60 seconds...")
        time.sleep(60)
    except Exception as e:
        logging.error(f"Error fetching trending posts: {e}")

def delivery_report(err, msg):
    if err is not None:
        logging.error(f"Message delivery failed: {err}")
    else:
        logging.info(f"Message delivered to {msg.topic()} [{msg.partition()}] at offset {msg.offset()}")

SHOULD_RUN = True

def _handle_termination(signum, frame):
    global SHOULD_RUN
    SHOULD_RUN = False

def run_loop(dry_run: bool, log_path: str | None = None):
    setup_logging(log_path)
    signal.signal(signal.SIGTERM, _handle_termination)
    signal.signal(signal.SIGINT, _handle_termination)

    get_producer(dry_run)
    logging.info(f"Starting Mastodon trending fetcher from {MASTODON_INSTANCE_URL}")
    try:
        while SHOULD_RUN:
            fetch_trending_posts(limit_per_tag=20)
            logging.info("Cycle complete.")
    finally:
        try:
            close_producer()
        except Exception:
            pass

# ---------------------------------------------------------------------
# Main polling loop
# ---------------------------------------------------------------------
if __name__ == "__main__":
    # Non-interactive flags
    if args.start:
        # Start as daemon
        try:
            daemonize(PID_FILE)
        except RuntimeError as e:
            setup_logging()
            logging.error(str(e))
            sys.exit(1)
        # In daemon process. set up file logging and run.
        run_loop(args.dry_run, LOG_FILE)
        # On exit, clean up PID file
        try:
            if os.path.exists(PID_FILE):
                os.remove(PID_FILE)
        except Exception:
            pass
        sys.exit(0)

    if args.stop:
        setup_logging()
        ok, msg = stop_daemon(PID_FILE)
        if ok:
            logging.info(msg)
            sys.exit(0)
        else:
            logging.error(msg)
            sys.exit(1)

    if args.status:
        setup_logging()
        pid = is_running(PID_FILE)
        if pid:
            logging.info(f"Background process is running with PID {pid}.")
            sys.exit(0)
        else:
            logging.info("No background process is running.")
            sys.exit(1)

    if args.foreground:
        setup_logging()
        run_loop(args.dry_run)
        sys.exit(0)

    # Interactive menu
    setup_logging()
    pid = is_running(PID_FILE)
    if pid:
        logging.info(f"Background process is currently running with PID {pid}.")
    print("")
    print("Choose an option:")
    print("  1) Run now in foreground (Ctrl+C to stop)")
    print("  2) Start in background and keep running")
    print("  3) Stop background process")
    print("  4) Status")
    choice = input("Enter choice [1-4]: ").strip() or "1"

    if choice == "1":
        run_loop(args.dry_run)
    elif choice == "2":
        try:
            daemonize(PID_FILE)
        except RuntimeError as e:
            logging.error(str(e))
            sys.exit(1)
        run_loop(args.dry_run, LOG_FILE)
        try:
            if os.path.exists(PID_FILE):
                os.remove(PID_FILE)
        except Exception:
            pass
    elif choice == "3":
        ok, msg = stop_daemon(PID_FILE)
        if ok:
            logging.info(msg)
        else:
            logging.error(msg)
            sys.exit(1)
    elif choice == "4":
        pid = is_running(PID_FILE)
        if pid:
            logging.info(f"Background process is running with PID {pid}.")
        else:
            logging.info("No background process is running.")
    else:
        logging.error("Invalid choice. Exiting.")
        sys.exit(1)
