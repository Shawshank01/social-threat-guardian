# Social Threat Guardian Mastodon Data Pipeline Guide

This guide documents the end-to-end setup. It goes from database preparation, to Kafka topic creation, to running the Mastodon producer and the Spark consumer that performs AI inference and writes results to Oracle.

---

## 1. Architecture overview

**Flow:** Mastodon API, then Kafka topic `mastodon-raw-posts`, then Spark Structured Streaming.  
1) Upsert to `RAWPOSTS`  
2) AI inference in Spark with an ONNX model, then write results to `PROCESSEDPOSTS`.

**Why two writes:** We first persist raw data to `RAWPOSTS` so foreign keys are satisfied, then we store AI results in `PROCESSEDPOSTS`.

**Why retain RawPosts:** It is preferable to retain RawPosts entity rather than remove them or place them outside the database, because this preserves data lineage and traceability. Keeping the original raw data allows for auditability, debugging, and understanding the provenance of AI inferences. This approach supports transparency and accountability in data processing pipelines, ensuring that downstream analyses can be traced back to their original inputs. Maintaining raw data alongside processed results enhances the robustness and trustworthiness of the data pipeline by enabling comprehensive traceability from source to inference. For more details on the importance of data lineage, see [Seemore Data's blog on data lineage](https://seemoredata.io/blog/data-lineage-in-2025-examples-techniques-best-practices/).

---

## 2. Prerequisites

- Oracle Autonomous DB or Oracle DB reachable from the Spark driver
- Oracle wallet on the machine that runs Spark
- Kafka brokers reachable from the producer and Spark
- Python 3.10+ virtual environment for local tooling
- Spark 3.4.1 with Kafka integration on the machine that runs the consumer

---

## 3. Environment and secrets

Create a `.env` file next to `Mastodon_Spark_Consumer.py` with:

```env
DB_USER=DIWEN2
DB_PASSWORD=your_password_here
DB_TNS_NAME=tud26ai_high
# Optional if you use these in other scripts
PYSPARK_DRIVER_PYTHON=/home/ubuntu/kafka_thesis/kafka_env/bin/python
PYSPARK_PYTHON=/home/ubuntu/kafka_thesis/kafka_env/bin/python
```

The Spark consumer loads `.env` automatically with `python-dotenv`.  
Make sure your wallet directory path inside the consumer matches your system:

```python
WALLET_PATH = "/home/ubuntu/kafka_thesis/thesis__wallet"
```

---

## 4. Python packages

Activate your venv and install the required packages:

```bash
source ~/kafka_thesis/kafka_env/bin/activate
pip install kafka-python Mastodon.py python-dotenv confluent-kafka pandas numpy transformers onnxruntime langid oci oracledb cx_Oracle
```

`oracledb` runs in thin mode with the wallet. `cx_Oracle` is kept as a fallback.

---

## 5. Oracle setup (use the 3 SQL scripts)

Run these in order to avoid privilege and foreign key errors.

### 5.1 Grants, run as a privileged user
Give `DIWEN2` the required permissions.

- **Script:** `DB/0-GRANT.sql`  
- **How to run with SQL*Plus:**
  ```bash
  sqlplus system@<tns_alias>
  @DB/0-GRANT.sql
  ```
- **How to run with SQL Developer:** Open `0-GRANT.sql` and Run as a user with admin rights.

### 5.2 Create schema objects, run as DIWEN2
Create all tables, constraints, and sequences in the `DIWEN2` schema.

- **Script:** `DB/1-Create-DB.sql`  
- **How to run with SQL*Plus:**
  ```bash
  sqlplus DIWEN2@<tns_alias>
  @DB/1-Create-DB.sql
  ```
- **How to run with SQL Developer:** Connect as `DIWEN2`, open `1-Create-DB.sql`, and Run.

### 5.3 Seed platforms, run as DIWEN2
Insert platform rows required by the pipeline. Mastodon, Bluesky, Telegram.

- **Script:** `DB/2-INSERT-platforms.sql`  
- **How to run with SQL*Plus:**
  ```bash
  sqlplus DIWEN2@<tns_alias>
  @DB/2-INSERT-platforms.sql
  ```
- **How to run with SQL Developer:** Connect as `DIWEN2`, open `2-INSERT-platforms.sql`, and Run.

> Tip. After running the scripts, quickly verify:
> - `PLATFORMS` has the expected rows.
> - `RAWPOSTS` and `PROCESSEDPOSTS` exist with constraints enabled.

---

## 6. Kafka setup

Start your Kafka broker or cluster. Example for single node:

```bash
bin/kafka-server-start.sh config/server.properties
```

Create the topic:

```bash
bin/kafka-topics.sh --create \
  --topic mastodon-raw-posts \
  --bootstrap-server 10.0.0.10:9092 \
  --partitions 3 \
  --replication-factor 1
```

List topics:

```bash
bin/kafka-topics.sh --list --bootstrap-server 10.0.0.10:9092
```

Optional consumer to inspect messages:

```bash
bin/kafka-console-consumer.sh \
  --topic mastodon-raw-posts \
  --from-beginning \
  --bootstrap-server 10.0.0.10:9092
```

---

## 7. Run the Mastodon producer

The producer fetches trending posts from Mastodon and pushes JSON messages to Kafka. Example invocation:

```bash
python3 mastodon_kafka_producer.py
```
When you run the command, you will see an interactive menu like this:
```text
Choose an option:
  1) Run now in foreground (Ctrl+C to stop)
  2) Start in background and keep running
  3) Stop background process
  4) Status
```

**What the options do**
- **1) Run now in foreground:** starts the producer in the terminal.
- **2) Start in background:** launches the producer as a daemon that continues after you log out. a PID file and log are written next to the script by default.
- **3) Stop background process:** stops the daemon if it is running. removes the PID file when it exits cleanly.
- **4) Status:** prints whether a background daemon is running and shows its PID if present.
By default the background run writes a PID file and a log next to the script:
- `mastodon_kafka_producer.pid`
- `mastodon_kafka_producer.log`

You can override with environment variables:
```bash
PID_FILE=/path/to/masto.pid LOG_FILE=/path/to/masto.log python3 mastodon_kafka_producer.py --start
```

You can test without Kafka writes using a dry run flag if your script supports it:

```bash
python3 mastodon_test.py --dry-run
```

Stop with `Ctrl+C`. If a process refuses to stop, find its PID and kill it:

```bash
ps aux | grep mastodon | grep python3
kill -9 <PID>
```

---

## 8. Run the Spark consumer

`Mastodon_Spark_Consumer.py` reads from Kafka, writes raw posts into `RAWPOSTS` with UPSERT, then performs AI inference and writes results into `PROCESSEDPOSTS`.

Make sure the Oracle JDBC jar is available:

```bash
ls /home/ubuntu/jdbc_drivers/ojdbc11.jar
```

Submit the job:

```bash
spark-submit \
  --master local[2] \
  --driver-memory 6g \
  --executor-memory 4g \
  --conf spark.executor.memoryOverhead=2g \
  --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.1,io.delta:delta-core_2.12:2.4.0 \
  --jars /home/ubuntu/jdbc_drivers/ojdbc11.jar \
  Mastodon_Spark_Consumer.py
```

### Run in background with nohup
This keeps the consumer running after you disconnect. Logs go to your home directory.
```bash
nohup spark-submit \
  --master local[2] \
  --driver-memory 6g \
  --executor-memory 4g \
  --conf spark.executor.memoryOverhead=2g \
  --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.1,io.delta:delta-core_2.12:2.4.0 \
  --jars /home/ubuntu/jdbc_drivers/ojdbc11.jar \
  Mastodon_Spark_Consumer.py \
  > ~/mastodon_consumer.log 2>&1 & echo $! > /tmp/mastodon_consumer.pid
```

**Check status**
```bash
ps -p $(cat /tmp/mastodon_consumer.pid) -o pid,ppid,etime,cmd
```

**Follow logs**
```bash
tail -f ~/mastodon_consumer.log
```

**Stop**
```bash
kill $(cat /tmp/mastodon_consumer.pid)
# if needed
kill -9 $(cat /tmp/mastodon_consumer.pid)
rm -f /tmp/mastodon_consumer.pid
```

### Quick verification in Oracle
After a few minutes of running, verify that rows are arriving in `PROCESSEDPOSTS`:
```sql
SELECT COUNT(*) FROM DIWEN2.PROCESSEDPOSTS;
SELECT MAX(PROCESSED_AT) FROM DIWEN2.PROCESSEDPOSTS;
```

The consumer uses `startingOffsets="latest"`.  
If you want to replay all retained Kafka data, change it to `"earliest"` in the script.

---

## 9. What the consumer does

- Reads Kafka value as JSON using a fixed schema
- Normalises timestamps to `datetime64[ns]` and makes them UTC naive for Oracle
- Writes raw records to `RAWPOSTS` using Oracle `MERGE` to avoid duplicate `POST_ID` errors
- Runs ONNX model for classification in a vectorised Pandas UDF
- Maps AI output to the `PROCESSEDPOSTS` schema
  - `THREAT_LEVEL` is a descriptive string derived from model label and confidence
  - `CONTAINS_HATE_SPEECH` is a numeric flag. 1 for harmful, 0 otherwise
  - `PROCESSED_ID` is auto generated by Oracle. do not include it in inserts

---

## 10. Common errors and fixes

- `--bootstrap-server must be specified`. Add `--bootstrap-server host:port` to Kafka CLI commands.
- `UNKNOWN_TOPIC_OR_PARTITION`. The topic does not exist on that broker. create it or correct the broker list.
- `TimeoutException` or `DisconnectException` on topic create. broker not reachable or wrong port. confirm broker status and networking.
- `No readable meta.properties files found`. Format KRaft logs and start the broker again:
  ```bash
  KAFKA_CLUSTER_ID="$(bin/kafka-storage.sh random-uuid)"
  bin/kafka-storage.sh format --standalone -t $KAFKA_CLUSTER_ID -c config/server.properties
  bin/kafka-server-start.sh config/server.properties
  ```
- `ORA-01031 insufficient privileges`. grant `INSERT, SELECT, UPDATE` on target tables to your user, or create the table under the same user you connect as.
- `ORA-02291 FK violated parent key not found`. seed `PLATFORMS` with ids you use. write to `RAWPOSTS` before `PROCESSEDPOSTS`.
- `ORA-12899 value too large for column VISIBILITY`. widen the column in `RAWPOSTS`:
  ```sql
  ALTER TABLE RAWPOSTS MODIFY VISIBILITY VARCHAR2(20);
  ```
- `ORA-01843 invalid month`. make sure Spark converts ISO 8601 timestamps:
  ```python
  to_timestamp(col("created_at"), "yyyy-MM-dd'T'HH:mm:ss.SSSXXX")
  ```
- `ORA-00001 unique constraint violated on RAWPOSTS(POST_ID)`. the consumer now performs UPSERT with `MERGE`. duplicates are ignored safely.
- `SparkClassNotFoundException data source. memory`. avoid `.format("memory")` writes, use JDBC or foreachBatch with proper sinks.

---

## 11. Operational order

1) Start Kafka brokers  
2) Start the Mastodon producer  
3) Start the Spark consumer

Kafka retains messages for the configured retention period, so starting Spark later does not lose data. Choose `startingOffsets` according to your need.

---

## 12. Verification queries

Check platform seed:

```sql
SELECT PLATFORM_ID, NAME FROM PLATFORMS ORDER BY PLATFORM_ID;
```

Check recent raw posts:

```sql
SELECT POST_ID, PLATFORM_ID, HASHTAG, CREATED_AT
FROM RAWPOSTS
ORDER BY CREATED_AT DESC FETCH FIRST 20 ROWS ONLY;
```

Check processed rows:

```sql
SELECT RAW_POST_ID, THREAT_LEVEL, CONTAINS_HATE_SPEECH, PROCESSED_AT
FROM PROCESSEDPOSTS
ORDER BY PROCESSED_ID DESC FETCH FIRST 20 ROWS ONLY;
```

---

## 13. Notes

- Avoid mixing underscores and periods at once in Kafka topic names to prevent metric name collisions
- `PROCESSED_ID` is generated by Oracle. do not attempt to supply it
- If you change schema names or wallet paths, adjust the consumer config accordingly

---

Happy streaming;-)
