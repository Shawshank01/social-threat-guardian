#!/usr/bin/env python3


import logging
import os
import sys
import re

# --- ML & Data ---
import numpy as np
import pandas as pd
from scipy.special import softmax
import onnxruntime
from transformers import AutoTokenizer

# --- Spark ---
from pyspark.sql import SparkSession, DataFrame
from pyspark.sql.functions import (
    col, from_json, to_timestamp, lit, concat,
    regexp_extract, size, split, when, lower, expr, pandas_udf,
    coalesce, current_timestamp
)
from pyspark.sql.types import (
    StructType, StructField, StringType,
    DoubleType, TimestampType
)

# Language Detection 
try:
    from langdetect import detect, LangDetectException
    from langdetect import DetectorFactory
    DetectorFactory.seed = 0
except ImportError:
    logging.error("langdetect not found. Please run: pip install langdetect")
    sys.exit(1)


# Logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("Bluskysparkco")


# Config — All settings externalized for maintainability

try:
    ORACLE_USER = os.environ["DB_USER"]
    ORACLE_PASS = os.environ["DB_PASSWORD"]
except KeyError:
    log.error("DB_USER and DB_PASSWORD environment variables not set.")
    sys.exit(1)

# Kafka
KAFKA_BOOTSTRAP = "10.0.0.10:9092"
KAFKA_TOPIC = "tweets"
CONSUMER_GROUP = "bluesky-hate-consumer"

# Data Sinks
# Sink 1: Oracle (Processed Data)
TNS_ADMIN_PATH = "/home/ubuntu/kafka_thesis/thesis__wallet"
ORACLE_DSN = "(description= (retry_count=20)(retry_delay=3)(address=(protocol=tcps)(port=1522)(host=adb.uk-london-1.oraclecloud.com))(connect_data=(service_name=g4c3ed8fbcfe40b_tud26ai_high.adb.oraclecloud.com))(security=(ssl_server_dn_match=yes)))"
ORACLE_JDBC_URL = f"jdbc:oracle:thin:@{ORACLE_DSN}?TNS_ADMIN={TNS_ADMIN_PATH}"
ORACLE_TABLE = "DIWEN.BLUSKY_TEST"
ORACLE_DRIVER = "oracle.jdbc.driver.OracleDriver"
ORACLE_BATCH_SIZE = "1000"

# JDBC properties for the Spark-native read/write
oracle_jdbc_properties = {
    "user": ORACLE_USER,
    "password": ORACLE_PASS,
    "driver": ORACLE_DRIVER
}

# Sink 2: Delta Lake bucket (Raw Data)
OCI_NAMESPACE = "lrbyxpimannd"
OCI_BUCKET_NAME = "DistilBERT"
OCI_LAKE_PATH = f"oci://{OCI_BUCKET_NAME}@{OCI_NAMESPACE}/data_lake/bluesky_raw_delta"

# Model & Paths
BASE_DIR = "/home/ubuntu"
MODEL_PATH = os.path.join(BASE_DIR, "model_cache/classifier/model.onnx")
TOKENIZER_PATH = os.path.join(BASE_DIR, "model_cache/classifier")

# Checkpoint
CHECKPOINT_DIR = "/home/ubuntu/spark_checkpoints/bluesky_pipeline"

# Spark & Pipeline Tuning
MAX_OFFSETS_PER_TRIGGER = 5000
ARROW_MAX_RECORDS_PER_BATCH = 500
PROCESSING_TIME_TRIGGER = "30 seconds"
MODEL_MAX_LENGTH = 128


# Spark session
os.environ["TNS_ADMIN"] = TNS_ADMIN_PATH

spark = (
    SparkSession.builder
    .appName("BluskySparkPipeline-v8.1")
    .config("spark.sql.streaming.checkpointLocation", CHECKPOINT_DIR)
    .config("spark.sql.execution.arrow.maxRecordsPerBatch", ARROW_MAX_RECORDS_PER_BATCH)
    .config("spark.sql.adaptive.enabled", "true")
    .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
    .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog")
    .config("spark.driver.extraJavaOptions", f"-Doracle.net.tns_admin={TNS_ADMIN_PATH}")
    .config("spark.executor.extraJavaOptions", f"-Doracle.net.tns_admin={TNS_ADMIN_PATH}")
    .getOrCreate()
)

log.info("Spark session initialized with Delta Lake support.")


# UDF 1 — Language Detection (Vectorized)
@pandas_udf("string")
def detect_language_vectorized(texts: pd.Series) -> pd.Series:
    """Detects language using vectorized .apply()."""
    def _safe_detect(text: str) -> str:
        if not text or not isinstance(text, str) or len(text.strip()) < 10:
            return 'und'
        try:
            return detect(text)
        except LangDetectException:
            return 'und'
    return texts.apply(_safe_detect)


# UDF 2 — Hate Speech Classification (Vectorized)

@pandas_udf(
    "struct<hate_score:double,pred_intent:string,pred_intensity:string>"
)
def classify_text_vectorized(texts: pd.Series) -> pd.DataFrame:
    """Runs inference on text using fully vectorized Pandas/Numpy ops."""
    if not hasattr(classify_text_vectorized, "session"):
        log.info(f"Loading ONNX model in worker from: {MODEL_PATH}")
        classify_text_vectorized.session = onnxruntime.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])
        classify_text_vectorized.tokenizer = AutoTokenizer.from_pretrained(TOKENIZER_PATH)
        log.info("Model loaded in worker")
    session = classify_text_vectorized.session
    tokenizer = classify_text_vectorized.tokenizer
    try:
        inputs = tokenizer(
            texts.tolist(),
            padding="max_length",
            truncation=True,
            max_length=MODEL_MAX_LENGTH,
            return_tensors="np"
        )
        logits = session.run(None, {"input_ids": inputs["input_ids"], "attention_mask": inputs["attention_mask"]})[0]
        probs = softmax(logits, axis=1)
        scores = probs[:, 1].astype(float)
        intent = np.where(scores > 0.5, "HARMFUL", "HARMLESS")
        conditions = [(scores > 0.9), (scores > 0.7), (scores > 0.5)]
        choices = ["VERY RADICAL", "RADICAL", "CHILL"]
        intensity = np.select(conditions, choices, default="VERY CHILL")
        return pd.DataFrame({
            "hate_score": scores,
            "pred_intent": intent,
            "pred_intensity": intensity
        })
    except Exception as e:
        log.error(f"Pandas UDF (classify) failed to process batch: {e}", exc_info=True)
        raise e


# Kafka schema


kafka_schema = StructType([
    StructField("id", StringType(), True),
    StructField("author_did", StringType(), True),
    StructField("author_handle", StringType(), True),
    StructField("text", StringType(), True),
    StructField("createdAt", StringType(), True),  # <-- THE FIX
    StructField("source", StringType(), True),
    StructField("mentions", StringType(), True),
    StructField("reply_to_uri", StringType(), True),
    StructField("repost_of_uri", StringType(), True),
])


# Read from Kafka

raw_kafka_stream = (
    spark.readStream
    .format("kafka")
    .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP)
    .option("subscribe", KAFKA_TOPIC)
    .option("kafka.group.id", CONSUMER_GROUP)
    .option("startingOffsets", "earliest")
    .option("maxOffsetsPerTrigger", str(MAX_OFFSETS_PER_TRIGGER))
    .load()
)

parsed_stream = (
    raw_kafka_stream
    .select(from_json(col("value").cast("string"), kafka_schema).alias("data"))
    .select("data.*")
    .filter(col("text").isNotNull() & (col("id").isNotNull()))
)


# Write to Sinks — Raw (Delta) + Enriched (Oracle)


def write_batch(raw_df: DataFrame, batch_id: int):
    """
    Implements the "Raw + Enriched" architecture with an
    idempotent Oracle sink using a Spark-native read-before-write.
    """
    log.info(f"--- Processing Batch {batch_id} ---")
    
    if raw_df.isEmpty():
        log.info(f"No new data in batch {batch_id}")
        return

    raw_df.cache()
    
    # 1. Data SINK 1: Save RAW Data to Delta Lake
    try:
        log.info(f"Writing raw data for batch {batch_id} to Delta Lake at {OCI_LAKE_PATH}...")
        (raw_df.write
            .format("delta")
            .mode("append")
            .option("mergeSchema", "true")
            .save(OCI_LAKE_PATH))
        log.info(f"Delta Lake write SUCCESS for batch {batch_id}")
    except Exception as e:
        log.error(f"DELTA LAKE WRITE FAILED for batch {batch_id}: {e}", exc_info=True)
        raw_df.unpersist()
        raise e
    
    # 2. Data SINK 2: Save ENRICHED Data to Oracle DB
    enriched_df = None
    final_df = None
    existing_keys = None
    try:
        log.info(f"Enriching data for batch {batch_id}...")
        
        enriched_df = (
            raw_df
            .withColumn("pred", classify_text_vectorized(col("text")))
            .withColumn("POST_LANGUAGE", detect_language_vectorized(col("text")))
            .withColumn("did", regexp_extract(col("id"), r"did:([^/]+)", 1))
            .withColumn("rkey", regexp_extract(col("id"), r"/([^/]+)$", 1))
            .withColumn("profile_id_for_link", coalesce(
                col("author_did"),
                col("author_handle"),
                col("did")
            ))
            .select(
                col("id").alias("POST_ID"),
                col("profile_id_for_link").alias("AUTHOR_HANDLE"),
                concat(
                    lit("https://bsky.app/profile/"), col("profile_id_for_link"),
                    lit("/post/"), col("rkey")
                ).alias("POST_URL"),
                
                
            
                when(
                    col("createdAt").isNotNull(),
                    to_timestamp(col("createdAt")) # <-- THE FIX
                ).otherwise(
                    current_timestamp()
                ).alias("POST_TIMESTAMP"),
                
                col("text").alias("POST_TEXT"),
                col("pred.pred_intensity").alias("PRED_INTENSITY"),
                col("pred.pred_intent").alias("PRED_INTENT"),
                lit("UNKNOWN").alias("PRED_TARGET"),
                col("POST_LANGUAGE"),
                lit(None).cast(StringType()).alias("PRED_ERROR"),
                col("pred.hate_score").cast(DoubleType()).alias("HATE_SCORE"),
                lit(0).alias("IS_CREDIBLE_THREAT"),
                col("mentions").alias("MENTIONS"),
                col("reply_to_uri").alias("REPLY_TO_URI"),
                col("repost_of_uri").alias("REPOST_OF_URI"),
                coalesce(size(split(col("mentions"), ",")), lit(0)).alias("MENTION_COUNT")
            )
        )
        
        final_df = enriched_df.filter(
            col("POST_ID").isNotNull() &
            col("AUTHOR_HANDLE").isNotNull() &
            col("POST_URL").isNotNull() &
            col("POST_TIMESTAMP").isNotNull()
        )
        
        final_df.persist()
        
        if final_df.isEmpty():
            log.info(f"No valid data to write to Oracle for batch {batch_id}")
            return
        
        log.info(f"Writing enriched data for batch {batch_id} to Oracle...")

        
        
        batch_keys = final_df.select("POST_ID").distinct()
        
        log.info(f"Step 1/3: Checking for existing keys in {ORACLE_TABLE}...")
        existing_keys = (spark.read
            .jdbc(url=ORACLE_JDBC_URL,
                  table=f"(SELECT POST_ID FROM {ORACLE_TABLE})", 
                  properties=oracle_jdbc_properties)
            .join(batch_keys, "POST_ID", "inner")
            .select("POST_ID")
            .cache()
        )
        
        existing_count = existing_keys.count()
        log.info(f"Step 2/3: Found {existing_count} existing keys (duplicates).")
        
        new_rows_df = final_df.join(existing_keys, "POST_ID", "left_anti")
        
        new_row_count = new_rows_df.count()
        log.info(f"Step 3/3: Appending {new_row_count} new rows to {ORACLE_TABLE}...")
        
        if new_row_count > 0:
            (new_rows_df.write
                .format("jdbc")
                .option("url", ORACLE_JDBC_URL)
                .option("dbtable", ORACLE_TABLE)
                .option("user", ORACLE_USER)
                .option("password", ORACLE_PASS)
                .option("driver", ORACLE_DRIVER)
                .option("batchsize", ORACLE_BATCH_SIZE)
                .mode("append")
                .save())
        
        log.info(f"Oracle write SUCCESS for batch {batch_id}. Duplicates prevented.")

    except Exception as e:
        log.error(f"ORACLE WRITE FAILED for batch {batch_id}: {e}", exc_info=True)
        raise e
    
    finally:
        raw_df.unpersist()
        if final_df is not None:
            final_df.unpersist()
        if existing_keys is not None:
            existing_keys.unpersist()


# Start

query = (
    parsed_stream.writeStream
    .foreachBatch(write_batch)
    .trigger(processingTime=PROCESSING_TIME_TRIGGER)
    .start()
)

log.info(f"Streaming query started — Bluskysparkco (v8.1 - Schema Fix)")
log.info(f"RAW data sink -> Delta Lake at {OCI_LAKE_PATH}")
log.info(f"PROCESSED data sink -> Oracle at {ORACLE_TABLE}")
log.info(f"CHECKPOINT location -> {CHECKPOINT_DIR}")
query.awaitTermination()