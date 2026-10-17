# Social Threat Guardian

[![Live Demo](https://img.shields.io/badge/Live_Demo-zerocool.vercel.app-2563eb?style=for-the-badge&logo=vercel)](https://zerocool.vercel.app)
[![AI Engine](https://img.shields.io/badge/AI-DistilBERT_%7C_ONNX_Runtime-ff6f00?style=for-the-badge)](Model%20training%20and%20Datasets/)
[![Streaming](https://img.shields.io/badge/Streaming-Apache_Kafka_%7C_Spark-000000?style=for-the-badge&logo=apachekafka)](Data%20Pipeline/)
[![Database](https://img.shields.io/badge/Database-Oracle_Autonomous_DB-F80000?style=for-the-badge&logo=oracle)](DB/)
[![Frontend](https://img.shields.io/badge/Frontend-React_%7C_TypeScript_%7C_Cytoscape-61DAFB?style=for-the-badge&logo=react)](frontend/)

**Social Threat Guardian** is an end-to-end, real-time AI risk-intelligence and threat-monitoring platform engineered to ingest, classify, and map coordinated harassment networks and toxic sentiment across decentralized social media streams.

Combining event-driven stream processing (**Apache Kafka & Apache Spark**), low-latency transformer inference (**multilingual DistilBERT via ONNX Runtime**), and enterprise relational persistence (**Oracle Autonomous Database 23ai**), the platform transforms high-velocity unstructured text into actionable threat indices, time-series telemetry, and interactive actor network graphs.

🔗 **Live Deployment:** [https://zerocool.vercel.app](https://zerocool.vercel.app)

---

## Key Engineering Highlights

* **Sub-Second Streaming Inference:** Decoupled heavy NLP inference from the application event loop by deploying a fine-tuned **multilingual DistilBERT** model optimized with **ONNX Runtime** inside **PySpark Structured Streaming** vectorized Pandas UDFs, achieving **<1s end-to-end alert latency**.
* **Precision/Recall Threshold Optimization:** Implemented custom decision boundary calibration (`>85%` classification accuracy, $\tau = 0.7054$) tailored for high-risk threat triage—maximizing recall on severe hostility while mitigating alert fatigue via stateful backend cooldown controls.
* **Audit-Compliant Data Lineage in Oracle Cloud:** Enforced an enterprise relational schema decoupling raw, immutable streams (`RawPosts`) from AI-inferred outputs (`ProcessedPosts`), ensuring GDPR auditability, data provenance, and fast analytical index aggregation.
* **Real-Time Visual Telemetry & Network Mapping:** Engineered WebSocket-driven dashboards displaying a live **5-zone Threat Index Gauge**, multi-resolution **Threat Trend Charts** (minute, hourly, daily rolling averages via **ApexCharts**), and interactive topological graphs using **Cytoscape.js**.
* **Decentralized Social Protocol Ingestion:** Built custom event producers capturing live firehose feeds from modern decentralized protocols, including **Bluesky (AT Protocol CAR sync)** and the **Mastodon Fediverse API**.

---

## System Architecture

The platform separates the high-speed alerting path (hot path) from historical graph and trend aggregation (analytical path) to maintain resilience during sudden traffic spikes.

![Social Threat Guardian system flowchart](System%20architecture/Flowchart.png)

### End-to-End Data Lifecycle

1. **Ingestion & Buffering (`Data Pipeline/` & `DB/`):** Live social streams from **Bluesky (AT Protocol)** and **Mastodon** are ingested and buffered into **Apache Kafka** topics to absorb traffic spikes and enforce schema contracts.
2. **Stream Processing & AI Triage (`Data Pipeline/` & `Model training and Datasets/`):** **Apache Spark Structured Streaming** consumers process micro-batches, executing hardware-accelerated **DistilBERT (ONNX)** models via Vectorized Pandas UDFs for toxicity scoring, sentiment intensity, and language identification. Raw streams are archived to an **OCI Delta Lake** for long-term lineage.
3. **Persistence & Relational Schema (`DB/`):** Enriched events, user safety watchlists, and threat indices are persisted in **Oracle Autonomous Database 23ai**, maintaining strict foreign-key integrity between raw content, inferences, and temporal index tables.
4. **Backend Orchestration (`backend/`):** A **Node.js / Express** service coordinates REST APIs, user authentication (JWT/Bcrypt), alert cooldown logic, **Web Push (VAPID)**, and **WebSocket** channels to push sub-second threat telemetry to connected clients.
5. **Interactive Risk Dashboard (`frontend/`):** A **React + TypeScript (Vite & Tailwind CSS)** single-page application visualizes global and platform-specific threat gauges, **ApexCharts** trend histories, and **Cytoscape.js** harassment network graphs.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **AI & Machine Learning** | Python, PyTorch, Hugging Face `distilbert-base-multilingual-cased`, **LoRA (PEFT)**, **ONNX Runtime**, Threshold Tuning (τ = 0.7054) |
| **Streaming & Big Data** | **Apache Kafka**, **Apache Spark Structured Streaming (PySpark)**, OCI Delta Lake, Vectorized Pandas UDFs |
| **Data Ingestion** | Bluesky AT Protocol Firehose (`subscribeRepos` CAR parsing), Mastodon API |
| **Database & Storage** | **Oracle Autonomous Database 23ai**, Relational Schema Modeling ([View ERD](DB/Database%20ER%20diagram%20v4.png)) |
| **Backend Services** | Node.js, Express.js, **WebSockets**, Web Push (VAPID), JWT, Bcrypt, Stateful Cooldown & Rate Limiting |
| **Frontend & Visualization** | React, TypeScript, Vite, Tailwind CSS, **Cytoscape.js** (fcose layout), **ApexCharts**, Radix UI |
| **DevOps & Infrastructure** | Vercel (Frontend CI/CD), Oracle Linux Cloud VM (PM2), Docker, Git/GitHub Projects (Agile Scrum) |

---

## Core Platform Capabilities

* **Real-Time Threat Index Gauges:** Live 5-zone hostility meters (*Harmony, Uneasy, Turbulent, Hostile, Toxic*) streaming instant atmospheric threat levels without requiring account registration.
* **Multi-Resolution Threat Trend Telemetry:** Dynamic temporal charts with minute (last 60m), hourly (last 72h), and daily (last 35d) rolling windows to detect emerging toxicity surges.
* **Coordinated Harassment Network Visualization:** Interactive node-edge graphs revealing central instigators, targeted victims, and cluster topologies across coordinated attacks.
* **Customizable Watchlists & Push Notifications:** Configurable keyword, language, and threat-level filters delivering real-time Web Push and in-app alerts with automated 6-hour cooldown throttling to prevent alert fatigue.
* **Protective User Safety Features:** Automatic content blurring for identified high-risk toxic posts to protect end-users and analysts from psychological distress.

---

## Repository Structure

```text
social-threat-guardian/
├── Data Pipeline/                 # Kafka producers/consumers, Spark streaming jobs & Bluesky AT Protocol ingestion
├── Model training and Datasets/   # Multilingual DistilBERT fine-tuning notebooks, ONNX export & threshold tuning
├── DB/                            # Oracle DDL scripts, Mastodon Kafka/Spark pipelines & ER Diagram (Database ER diagram v4.png)
├── backend/                       # Express API server, WebSocket handlers, Web Push (VAPID) & cooldown monitor
├── frontend/                      # React + TypeScript UI, Cytoscape network graphs & ApexCharts dashboards
├── System architecture/           # High-level system architecture diagrams (PNG & PDF)
├── meetingLogs/                   # Agile sprint planning and engineering coordination logs
└── retrospective/                 # Sprint retrospectives and continuous delivery documentation
```

---

## Architectural Roadmap & Future Evolution

* **Autonomous Agentic Triage (Two-Tier Hybrid AI):** Retain the lightweight DistilBERT + ONNX pipeline for high-speed streaming classification, while triggering autonomous LLM reasoning agents on high-severity anomalies to cross-reference actor histories and draft structured incident briefs.
* **Vector Search over Historical Telemetry:** Leverage Oracle AI Vector Search to store semantic embeddings of past harassment campaigns, enabling natural-language analyst queries with strict source grounding.
* **Additional Social Connectors:** Expand ingestion connectors to Telegram, Discord, and Reddit, incorporating vision-language models for meme and multimedia threat detection.
* **Mobile Push Channels:** Extend the current Web Push (VAPID) service to native Apple Push Notification service (APNs) and Firebase Cloud Messaging (FCM).
