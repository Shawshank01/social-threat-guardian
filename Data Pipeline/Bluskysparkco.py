#!/usr/bin/env python3
import logging
import os
import sys
import numpy as np
import pandas as pd
from scipy.special import softmax
import onnxruntime
from transformers import AutoTokenizer
from pyspark.sql import SparkSession, DataFrame
from pyspark.sql.functions import (
    col, from_json, to_timestamp, lit, concat,
    regexp_extract, size, split, when, coalesce, current_timestamp,
    pandas_udf
)
from pyspark.sql.types import (
    StructType, StructField, StringType,
    DoubleType, TimestampType
)
try:
    from langdetect import detect, LangDetectException
    from langdetect import DetectorFactory
    DetectorFactory.seed = 0
except ImportError:
    logging.error("langdetect not installed. Run: pip install langdetect")
    sys.exit(1)
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("bluesky_hate_classifier")
ORACLE_USER = os.environ["DB_USER"]
ORACLE_PASS = os.environ["DB_PASSWORD"]
TNS_ADMIN_PATH = "/home/ubuntu/kafka_thesis/thesis__wallet"
ORACLE_DSN = "(description=(retry_count=20)(retry_delay=3)(address=(protocol=tcps)(port=1522)(host=adb.uk-london-1.oraclecloud.com))(connect_data=(service_name=g4c3ed8fbcfe40b_tud26ai_high.adb.oraclecloud.com))(security=(ssl_server_dn_match=yes)))"
ORACLE_JDBC_URL = f"jdbc:oracle:thin:@{ORACLE_DSN}?TNS_ADMIN={TNS_ADMIN_PATH}"
ORACLE_TABLE = "DIWEN.BLUSKY_TEST"
ORACLE_DRIVER = "oracle.jdbc.driver.OracleDriver"
KAFKA_BOOTSTRAP = "10.0.0.10:9092"
KAFKA_TOPIC = "tweets"
CONSUMER_GROUP = "bluesky-hate-consumer"
OCI_NAMESPACE = "lrbyxpimannd"
OCI_BUCKET_NAME = "DistilBERT"
OCI_LAKE_PATH = f"oci://{OCI_BUCKET_NAME}@{OCI_NAMESPACE}/data_lake/bluesky_raw_delta"
BASE_DIR = "/home/ubuntu"
MODEL_PATH = os.path.join(BASE_DIR, "model_cache/classifier/model.onnx")
TOKENIZER_PATH = os.path.join(BASE_DIR, "model_cache/classifier")
CHECKPOINT_DIR = "/home/ubuntu/spark_checkpoints/bluesky_pipeline"
MAX_OFFSETS_PER_TRIGGER = 500
PROCESSING_TIME_TRIGGER = "30 seconds"
MODEL_MAX_LENGTH = 128
ARROW_MAX_RECORDS_PER_BATCH = 5000
# Threshold optimization of the distilbert model i built.
OPTIMAL_THRESHOLD = 0.7054
os.environ["TNS_ADMIN"] = TNS_ADMIN_PATH
spark = (
    SparkSession.builder
    .appName("BlueskyHateClassifier")
    .config("spark.sql.streaming.checkpointLocation", CHECKPOINT_DIR)
    .config("spark.sql.execution.arrow.maxRecordsPerBatch", str(ARROW_MAX_RECORDS_PER_BATCH))
    .config("spark.sql.execution.pandas.convertToArrowArraySafely", "true")
    .config("spark.sql.adaptive.enabled", "true")
    .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
    .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog")
    .config("spark.driver.extraJavaOptions", f"-Doracle.net.tns_admin={TNS_ADMIN_PATH}")
    .config("spark.executor.extraJavaOptions", f"-Doracle.net.tns_admin={TNS_ADMIN_PATH}")
    .getOrCreate()
)
log.info("Spark session initialized.")
@pandas_udf("string")
def detect_language(texts: pd.Series) -> pd.Series:
    def safe_detect(text: str) -> str:
        if not text or not isinstance(text, str) or len(text.strip()) < 10:
            return "und"
        try:
            return detect(text)
        except LangDetectException:
            return "und"
    return texts.apply(safe_detect)
@pandas_udf("struct<hate_score:double,pred_intent:string,pred_intensity:string>")
def classify_hate_speech(texts: pd.Series) -> pd.DataFrame:
    if not hasattr(classify_hate_speech, "session"):
        log.info(f"Loading ONNX model from {MODEL_PATH}")
        classify_hate_speech.session = onnxruntime.InferenceSession(
            MODEL_PATH, providers=["CPUExecutionProvider"]
        )
        classify_hate_speech.tokenizer = AutoTokenizer.from_pretrained(TOKENIZER_PATH)
    session = classify_hate_speech.session
    tokenizer = classify_hate_speech.tokenizer
    n = len(texts)
    fallback = pd.DataFrame({
        "hate_score": [0.0] * n,
        "pred_intent": ["HARMLESS"] * n,
        "pred_intensity": ["VERY CHILL"] * n
    })
    try:
        valid = texts.fillna("").astype(str)
        valid = valid[valid.str.strip().str.len() > 5]
        if len(valid) == 0:
            return fallback
        inputs = tokenizer(
            valid.tolist(),
            padding="max_length",
            truncation=True,
            max_length=MODEL_MAX_LENGTH,
            return_tensors="np"
        )
        logits = session.run(None, {
            "input_ids": inputs["input_ids"],
            "attention_mask": inputs["attention_mask"]
        })[0]
        probs = softmax(logits, axis=1)
        scores = probs[:, 1].astype(float)
        intent = np.where(scores >= OPTIMAL_THRESHOLD, "HARMFUL", "HARMLESS")
        intensity = np.select(
            [scores >= 0.92, scores >= 0.80, scores >= OPTIMAL_THRESHOLD],
            ["VERY RADICAL", "RADICAL", "SUSPICIOUS"],
            default="VERY CHILL"
        )
        result = pd.DataFrame({
            "hate_score": scores,
            "pred_intent": intent,
            "pred_intensity": intensity
        })
        result = result.reindex(range(n)).fillna({
            "hate_score": 0.0,
            "pred_intent": "HARMLESS",
            "pred_intensity": "VERY CHILL"
        })
        return result
    except Exception as e:
        log.error(f"Hate speech UDF failed on batch of {n} rows: {e}", exc_info=True)
        return fallback
kafka_schema = StructType([
    StructField("id", StringType(), True),
    StructField("author_did", StringType(), True),
    StructField("author_handle", StringType(), True),
    StructField("text", StringType(), True),
    StructField("createdAt", StringType(), True),
    StructField("source", StringType(), True),
    StructField("mentions", StringType(), True),
    StructField("reply_to_uri", StringType(), True),
    StructField("repost_of_uri", StringType(), True),
])
raw_stream = (
    spark.readStream
    .format("kafka")
    .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP)
    .option("subscribe", KAFKA_TOPIC)
    .option("kafka.group.id", CONSUMER_GROUP)
    .option("startingOffsets", "latest")
    .option("maxOffsetsPerTrigger", str(MAX_OFFSETS_PER_TRIGGER))
    .load()
)
parsed_stream = (
    raw_stream
    .select(from_json(col("value").cast("string"), kafka_schema).alias("data"))
    .select("data.*")
    .filter(col("text").isNotNull() & col("id").isNotNull())
)
def process_batch(df: DataFrame, batch_id: int):
    log.info(f"Processing batch {batch_id}")
    if df.rdd.isEmpty():
        log.info("Empty batch — skipping.")
        return
    df.cache()
    input_count = df.count()
    log.info(f"Input records: {input_count}")
    try:
        log.info("Writing raw data to Delta Lake.")
        (df.write
            .format("delta")
            .mode("append")
            .option("mergeSchema", "true")
            .save(OCI_LAKE_PATH))
        log.info("Delta Lake write complete.")
    except Exception as e:
        log.error(f"Delta Lake write failed: {e}", exc_info=True)
        df.unpersist()
        raise
    try:
        enriched = (
            df
            .withColumn("pred", classify_hate_speech(col("text")))
            .withColumn("lang", detect_language(col("text")))
            .withColumn("did", regexp_extract(col("id"), r"did:([^/]+)", 1))
            .withColumn("rkey", regexp_extract(col("id"), r"/([^/]+)$", 1))
            .withColumn("author", coalesce(col("author_did"), col("author_handle"), col("did")))
            .select(
                col("id").alias("POST_ID"),
                col("author").alias("AUTHOR_HANDLE"),
                concat(lit("https://bsky.app/profile/"), col("author"), lit("/post/"), col("rkey")).alias("POST_URL"),
                when(col("createdAt").isNotNull(), to_timestamp(col("createdAt")))
                .otherwise(current_timestamp()).alias("POST_TIMESTAMP"),
                col("text").alias("POST_TEXT"),
                col("pred.pred_intensity").alias("PRED_INTENSITY"),
                col("pred.pred_intent").alias("PRED_INTENT"),
                lit("UNKNOWN").alias("PRED_TARGET"),
                col("lang").alias("POST_LANGUAGE"),
                lit(None).cast(StringType()).alias("PRED_ERROR"),
                col("pred.hate_score").cast(DoubleType()).alias("HATE_SCORE"),
                lit(0).alias("IS_CREDIBLE_THREAT"),
                col("mentions").alias("MENTIONS"),
                col("reply_to_uri").alias("REPLY_TO_URI"),
                col("repost_of_uri").alias("REPOST_OF_URI"),
                coalesce(size(split(col("mentions"), ",")), lit(0)).alias("MENTION_COUNT")
            )
        )
        final = enriched.filter(
            col("POST_ID").isNotNull() &
            col("AUTHOR_HANDLE").isNotNull() &
            col("POST_URL").isNotNull() &
            col("POST_TIMESTAMP").isNotNull()
        )
        final.persist()
        log.info("Writing enriched data to Oracle (PK deduplication enforced).")
        (final.write
            .format("jdbc")
            .option("url", ORACLE_JDBC_URL)
            .option("dbtable", ORACLE_TABLE)
            .option("user", ORACLE_USER)
            .option("password", ORACLE_PASS)
            .option("driver", ORACLE_DRIVER)
            .option("batchsize", "5000")
            .option("rewriteBatchedStatements", "true")
            .mode("append")
            .save())
        log.info(f"Oracle write complete for batch {batch_id}.")
        final.unpersist()
    except Exception as e:
        if "ORA-00001" in str(e):
            log.info("Duplicate POST_ID(s) skipped (PK_BLUESKY).")
        else:
            log.error(f"Oracle enrichment/write failed: {e}", exc_info=True)
            raise
    finally:
        df.unpersist()
query = (
    parsed_stream.writeStream
    .foreachBatch(process_batch)
    .trigger(processingTime=PROCESSING_TIME_TRIGGER)
    .start()
)
log.info("Streaming pipeline started.")
log.info(f"Raw sink → {OCI_LAKE_PATH}")
log.info(f"Enriched sink → {ORACLE_TABLE}")
log.info(f"Checkpoint → {CHECKPOINT_DIR}")
query.awaitTermination()