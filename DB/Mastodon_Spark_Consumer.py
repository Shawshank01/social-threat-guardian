#!/usr/bin/env python3
import json
import logging
import os
import sys
from dotenv import load_dotenv
from typing import Tuple
import numpy as np
import pandas as pd
from scipy.special import softmax
from pyspark.sql import SparkSession, DataFrame
from pyspark.sql.functions import (
    from_json, col, to_timestamp, pandas_udf, lit, date_format
)
from pyspark.sql.types import (
    StructType, StructField, StringType, DoubleType
)
import oci
import onnxruntime
from transformers import AutoTokenizer
import langid

try:
    import oracledb  # python-oracledb thin mode does not require Instant Client
    CX_FALLBACK = None
except Exception:
    oracledb = None
    CX_FALLBACK = True
    import cx_Oracle  # fallback (requires Instant Client)

# ---------------------------------------------------------------------
# Load environment variables from .env
# ---------------------------------------------------------------------
load_dotenv()

# ---------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------
log = logging.getLogger("MastodonConsumer")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)

# ---------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------
class Config:
    KAFKA_BOOTSTRAP_SERVER = "10.0.0.10:9092"
    KAFKA_TOPIC            = "mastodon-raw-posts"
    CONSUMER_GROUP_ID      = "spark-hate-speech-consumer"

    OCI_NAMESPACE   = "lrbyxpimannd"
    OCI_BUCKET_NAME = "DistilBERT"
    OCI_CLASSIFIER_MODEL_PATH = ""

    ORACLE_SCHEMA   = "DIWEN2"
    RAWPOSTS_TABLE_NAME = f"{ORACLE_SCHEMA}.RAWPOSTS"
    DB_TABLE_NAME   = f"{ORACLE_SCHEMA}.PROCESSEDPOSTS"

    DB_USER     = os.environ.get("DB_USER")
    DB_PASSWORD = os.environ.get("DB_PASSWORD")
    DB_TNS_NAME = os.environ.get("DB_TNS_NAME")

    MODEL_CACHE_DIR = os.path.expanduser("~/model_cache")
    WALLET_PATH = "/home/ubuntu/kafka_thesis/thesis__wallet"

    def __init__(self):
        if not all([self.DB_USER, self.DB_PASSWORD, self.DB_TNS_NAME]):
            log.error("FATAL: DB_USER, DB_PASSWORD, DB_TNS_NAME must be set.")
            raise ValueError("Missing DB credentials")
        os.environ.setdefault("TNS_ADMIN", self.WALLET_PATH)
        self.JDBC_URL = f"jdbc:oracle:thin:@{self.DB_TNS_NAME}?TNS_ADMIN={self.WALLET_PATH}"
        self.CLASSIFIER_CACHE_DIR = os.path.join(self.MODEL_CACHE_DIR, "classifier")
        self.ONNX_CLASSIFIER_PATH = os.path.join(self.CLASSIFIER_CACHE_DIR, "model.onnx")

# ---------------------------------------------------------------------
# Model loading
# ---------------------------------------------------------------------
def _download_model_files(client, cfg, prefix, local_dir):
    if prefix is None:
        prefix = ""
    os.makedirs(local_dir, exist_ok=True)
    objs = client.list_objects(cfg.OCI_NAMESPACE, cfg.OCI_BUCKET_NAME, prefix=prefix).data.objects
    for o in objs:
        if o.name.endswith("/"):
            continue
        dest = os.path.join(local_dir, os.path.basename(o.name))
        resp = client.get_object(cfg.OCI_NAMESPACE, cfg.OCI_BUCKET_NAME, o.name)
        with open(dest, "wb") as f:
            f.write(resp.data.content)

def _get_or_load_model(cfg: Config) -> Tuple:
    cache_dir = cfg.CLASSIFIER_CACHE_DIR
    onnx_path = cfg.ONNX_CLASSIFIER_PATH
    if not os.path.exists(onnx_path):
        log.warning("Downloading model from OCI...")
        signer = oci.auth.signers.InstancePrincipalsSecurityTokenSigner()
        client = oci.object_storage.ObjectStorageClient(config={}, signer=signer)
        _download_model_files(client, cfg, cfg.OCI_CLASSIFIER_MODEL_PATH, cache_dir)

    tokenizer = AutoTokenizer.from_pretrained(cache_dir)
    session = onnxruntime.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
    return tokenizer, session

# ---------------------------------------------------------------------
# Helper function to get Oracle connection
# ---------------------------------------------------------------------
def _get_oracle_connection(cfg: Config):
    """
    Return an Oracle DB connection.
    Prefer python-oracledb (thin mode) using wallet config_dir, which avoids DPI-1047.
    Fallback to cx_Oracle if python-oracledb is unavailable (requires Instant Client).
    """
    if oracledb is not None:
        # Thin mode: use wallet directory via config_dir and a TNS alias in dsn
        return oracledb.connect(
            user=cfg.DB_USER,
            password=cfg.DB_PASSWORD,
            dsn=cfg.DB_TNS_NAME,  # alias from tnsnames.ora inside the wallet
            config_dir=cfg.WALLET_PATH,
        )
    # Fallback (will require Instant Client installed and on library path)
    return cx_Oracle.connect(
        user=cfg.DB_USER,
        password=cfg.DB_PASSWORD,
        dsn=cfg.DB_TNS_NAME,  # use TNS alias with TNS_ADMIN wallet
        encoding="UTF-8",
        nencoding="UTF-8",
    )

# ---------------------------------------------------------------------
# Batch processing
# ---------------------------------------------------------------------
def _ensure_datetime64ns_naive(s: pd.Series) -> pd.Series:
    """
    Normalise a pandas Series of datetimes to timezone-naive UTC with ns precision.
    This avoids errors like: "Passing in 'datetime64' dtype with no precision is not allowed."
    """
    s = pd.to_datetime(s, errors="coerce", utc=True)
    # Convert to UTC tz-aware, then drop tz to make it naive
    s = s.dt.tz_convert("UTC").dt.tz_localize(None)
    # Ensure explicit ns precision
    return s.astype("datetime64[ns]")

def process_batch(batch_df: DataFrame, epoch_id: int):
    cfg = Config()
    log.info(f"Processing batch {epoch_id}")
    batch_df.cache()

    # Insert raw posts into RAWPOSTS table first using MERGE to perform UPSERT
    rawposts_df = batch_df.select(
        col("post_id").alias("POST_ID"),
        col("platform_id").alias("PLATFORM_ID"),
        col("hashtag").alias("HASHTAG"),
        col("username").alias("USERNAME"),
        col("display_name").alias("DISPLAY_NAME"),
        col("post_content").alias("POST_CONTENT"),
        to_timestamp(col("created_at"), "yyyy-MM-dd'T'HH:mm:ss.SSSXXX").alias("CREATED_AT"),
        col("language").alias("LANGUAGE"),
        col("url").alias("URL"),
        col("visibility").alias("VISIBILITY"),
        to_timestamp(col("collected_at"), "yyyy-MM-dd'T'HH:mm:ss.SSSXXX").alias("COLLECTED_AT")
    )

    # Work around pandas datetime dtype precision bug during toPandas conversion by casting timestamps to strings first.
    # Preserve offset-style formatting so pandas can parse reliably with utc=True.
    rawposts_df = (
        rawposts_df
        .withColumn("CREATED_AT", date_format(col("CREATED_AT"), "yyyy-MM-dd'T'HH:mm:ss.SSSXXX"))
        .withColumn("COLLECTED_AT", date_format(col("COLLECTED_AT"), "yyyy-MM-dd'T'HH:mm:ss.SSSXXX"))
    )

    def upsert_rawposts_pandas(df: pd.DataFrame):
        # Force datetime precision to ns and make datetimes timezone-naive UTC
        for col_name in ["CREATED_AT", "COLLECTED_AT"]:
            if col_name in df.columns:
                df[col_name] = _ensure_datetime64ns_naive(df[col_name])
        connection = None
        cursor = None
        try:
            connection = _get_oracle_connection(cfg)
            cursor = connection.cursor()
            merge_sql = f"""
            MERGE INTO {cfg.RAWPOSTS_TABLE_NAME} target
            USING dual
            ON (target.POST_ID = :POST_ID)
            WHEN NOT MATCHED THEN
              INSERT (
                POST_ID, PLATFORM_ID, HASHTAG, USERNAME, DISPLAY_NAME,
                POST_CONTENT, CREATED_AT, LANGUAGE, URL, VISIBILITY, COLLECTED_AT
              ) VALUES (
                :POST_ID, :PLATFORM_ID, :HASHTAG, :USERNAME, :DISPLAY_NAME,
                :POST_CONTENT, :CREATED_AT, :LANGUAGE, :URL, :VISIBILITY, :COLLECTED_AT
              )
            """
            for _, row in df.iterrows():
                created_at_val = None
                if pd.notnull(row["CREATED_AT"]):
                    # row["CREATED_AT"] is a pandas Timestamp normalized to naive UTC with ns precision
                    created_at_val = row["CREATED_AT"].to_pydatetime()
                collected_at_val = None
                if pd.notnull(row["COLLECTED_AT"]):
                    collected_at_val = row["COLLECTED_AT"].to_pydatetime()
                params = {
                    'POST_ID': row['POST_ID'],
                    'PLATFORM_ID': row['PLATFORM_ID'],
                    'HASHTAG': row['HASHTAG'],
                    'USERNAME': row['USERNAME'],
                    'DISPLAY_NAME': row['DISPLAY_NAME'],
                    'POST_CONTENT': row['POST_CONTENT'],
                    'CREATED_AT': created_at_val,
                    'LANGUAGE': row['LANGUAGE'],
                    'URL': row['URL'],
                    'VISIBILITY': row['VISIBILITY'],
                    'COLLECTED_AT': collected_at_val
                }
                try:
                    cursor.execute(merge_sql, params)
                except Exception as e:
                    log.error(f"[Batch {epoch_id}] MERGE failed for POST_ID {row['POST_ID']}: {e}", exc_info=True)
            connection.commit()
            log.info(f"[Batch {epoch_id}] Upserted {len(df)} rows to RAWPOSTS.")
        except Exception as e:
            log.error(f"[Batch {epoch_id}] Oracle connection or MERGE failed: {e}", exc_info=True)
        finally:
            if cursor:
                cursor.close()
            if connection:
                connection.close()

    try:
        pandas_df = rawposts_df.toPandas()
        # Normalise to explicit datetime64[ns] and drop timezone for Oracle compatibility
        for col_name in ["CREATED_AT", "COLLECTED_AT"]:
            if col_name in pandas_df.columns:
                pandas_df[col_name] = _ensure_datetime64ns_naive(pandas_df[col_name])
        if not pandas_df.empty:
            upsert_rawposts_pandas(pandas_df)
    except Exception as e:
        log.error(f"[Batch {epoch_id}] Failed to upsert RAWPOSTS: {e}", exc_info=True)

    @pandas_udf("string")
    def run_inference(texts: pd.Series) -> pd.Series:
        if "model" not in globals():
            cfg_local = Config()
            globals()["model"] = _get_or_load_model(cfg_local)
        tokenizer, session = globals()["model"]

        results = []
        for text in texts:
            if not text:
                results.append(json.dumps({"error": "empty"}))
                continue
            try:
                enc = tokenizer([text], truncation=True, padding="max_length", max_length=128, return_tensors="np")
                out = session.run(None, {"input_ids": enc["input_ids"], "attention_mask": enc["attention_mask"]})
                probs = softmax(out[0], axis=1)
                label = int(np.argmax(probs))
                score = float(np.max(probs))
                intensity = (
                    "VERY RADICAL" if label == 2 and score > 0.9 else
                    "RADICAL" if label == 2 else
                    "NEUTRAL" if label == 1 else
                    "CHILL" if score > 0.8 else
                    "VERY CHILL"
                )
                intent = "HARMFUL" if label == 2 else "NEUTRAL" if label == 1 else "HARMLESS"
                target = "GROUP" if label == 2 else "INDIVIDUAL" if label == 1 else "NONE"
                lang = langid.classify(text)[0] if text else "unknown"
                results.append(json.dumps({
                    "intensity": intensity,
                    "intent": intent,
                    "target": target,
                    "language": lang,
                    "confidence": score
                }))
            except Exception as e:
                results.append(json.dumps({"error": str(e)}))
        return pd.Series(results)

    pred_schema = StructType([
        StructField("intensity", StringType(), True),
        StructField("intent", StringType(), True),
        StructField("target", StringType(), True),
        StructField("language", StringType(), True),
        StructField("confidence", DoubleType(), True),
        StructField("error", StringType(), True)
    ])

    enriched = batch_df.withColumn("model_output", run_inference(col("post_content")))
    final = (
        enriched.withColumn("p", from_json(col("model_output"), pred_schema))
        .select(
            col("raw_post_id").alias("RAW_POST_ID"),
            col("platform_id").alias("PLATFORM_ID"),
            col("hashtag").alias("HASHTAG"),
            col("post_content").alias("POST_CONTENT"),
            to_timestamp(col("created_at")).alias("CREATED_AT"),
            col("language").alias("LANGUAGE"),
            col("url").alias("URL"),
            col("p.intensity").alias("THREAT_LEVEL"),
            ((col("p.intent") == "HARMFUL").cast("int")).alias("CONTAINS_HATE_SPEECH"),
            to_timestamp(lit(None)).alias("PROCESSED_AT"),
            col("p.error").alias("PROCESSING_STATUS")
        )
    )

    try:
        (final.write.format("jdbc")
               .option("url", cfg.JDBC_URL)
               .option("dbtable", cfg.DB_TABLE_NAME)
               .option("user", cfg.DB_USER)
               .option("password", cfg.DB_PASSWORD)
               .option("driver", "oracle.jdbc.driver.OracleDriver")
               .mode("append")
               .save())
        log.info(f"[Batch {epoch_id}] Written {final.count()} rows to Oracle.")
    except Exception as e:
        log.error(f"[Batch {epoch_id}] Oracle write failed: {e}", exc_info=True)

    batch_df.unpersist()

# ---------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------
def main():
    log.info("Starting Spark Streaming consumer for Mastodon...")
    cfg = Config()

    spark = (
        SparkSession.builder
        .appName("MastodonConsumer")
        .config("spark.driver.extraJavaOptions", f"-Doracle.net.tns_admin={cfg.WALLET_PATH}")
        .config("spark.executor.extraJavaOptions", f"-Doracle.net.tns_admin={cfg.WALLET_PATH}")
        .config("spark.sql.execution.arrow.pyspark.enabled", "false")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")

    schema = StructType([
        StructField("post_id", StringType(), True),
        StructField("raw_post_id", StringType(), True),
        StructField("platform_id", StringType(), True),
        StructField("hashtag", StringType(), True),
        StructField("username", StringType(), True),
        StructField("display_name", StringType(), True),
        StructField("post_content", StringType(), True),
        StructField("created_at", StringType(), True),
        StructField("language", StringType(), True),
        StructField("url", StringType(), True),
        StructField("visibility", StringType(), True),
        StructField("collected_at", StringType(), True)
    ])

    kafka = (
        spark.readStream.format("kafka")
        .option("kafka.bootstrap.servers", cfg.KAFKA_BOOTSTRAP_SERVER)
        .option("subscribe", cfg.KAFKA_TOPIC)
        .option("kafka.group.id", cfg.CONSUMER_GROUP_ID)
        .option("startingOffsets", "latest")
        .load()
    )

    stream = (
        kafka.select(from_json(col("value").cast("string"), schema).alias("d"))
        .select("d.*")
        .filter(col("post_content").isNotNull())
    )

    q = (
        stream.writeStream
        .outputMode("append")
        .foreachBatch(process_batch)
        .option("checkpointLocation", "/tmp/mastodon_spark_checkpoints")
        .trigger(processingTime="30 seconds")
        .start()
    )

    log.info("Streaming started. Press Ctrl+C to stop.")
    q.awaitTermination()

if __name__ == "__main__":
    main()
