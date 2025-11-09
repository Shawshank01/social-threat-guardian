# Social Threat Guardian

## Introduction
Social Threat Guardian is an AI-powered system designed to detect, monitor, and visualise threats and harassment on social media platforms, with a focus on protecting freedom of speech advocates. Recent data indicates a significant increase in targeted online harassment that can escalate to physical harm, necessitating timely and accurate threat identification. By leveraging advanced Natural Language Processing (NLP) models and real-time data ingestion, the system aims to provide early warning signals and actionable insights to users. The motivation stems from the need to safeguard individuals facing sophisticated and pervasive online threats, enabling proactive responses such as account protection or law enforcement notification.

## Target Users
- **General Social Media Users:** Seek awareness of the overall threat environment and platform sentiment without requiring account registration.
- **Registered Users:** Require customisable monitoring by keywords and languages, real-time alerts, and detailed content analysis to manage personal safety.
- **Security Analysts and Moderators:** Utilise harassment network visualisations and threat indices to understand coordinated campaigns and emerging risks for informed intervention.

## Technical Approach
1. **Data Ingestion**
   - Collect data from social media platforms (Bluesky, Mastodon, Telegram) via their APIs.
   - Supplement live data streams with historical datasets in CSV and JSON formats.
   - Employ Apache Kafka and Spark for event-driven streaming and real-time data pipeline management.

2. **AI Processing**
   - Apply DistilBERT-based NLP models for text classification, sentiment analysis, and entity recognition to identify threatening language and context.
   - Process data within an Oracle 26 ai database to leverage in-database machine learning and enhance performance.

3. **Backend Orchestration**
   - Use Express to coordinate data flow, model inference, and user request handling.
   - Integrate Kafka consumers and producers for seamless data streaming and event processing.

4. **Frontend Visualization**
   - Develop a React and TypeScript-based user interface.
   - Provide dashboards displaying global and platform-specific threat indices, latest hateful post content, and harassment network maps.
   - Users who are logged in have access to more functionalities.

## Expected Outcomes
- A global threat index gauge offering users a quick overview of social media atmosphere and hostility levels.
- Display of individual platform indices and latest posts to inform users about current discussions without account registration.
- Registered users can define monitoring preferences, set up filters, receive real-time alerts on potential threats, and identify harmful content.
- Visualisation of harassment networks to provide registered users with comprehensive insight into coordinated threats and enhance situational awareness.

## Evaluation and Success Criteria
- **Technical Evaluation:** Assess system throughput, latency, and accuracy of threat detection using benchmark datasets and live data streams.
- **User Evaluation:** Gather feedback on usability, alert relevance, and visualisation clarity from target user groups.
- **Quantitative Targets:** Achieve at least 85% accuracy in threat classification, sub-second backend response times for alert generation, and positive user satisfaction ratings above 80%.

## Motivation and Purpose
The Social Threat Guardian project responds to the increasing sophistication and prevalence of online harassment targeting freedom of speech advocates. Early detection and intervention are critical to preventing harm and maintaining open discourse. By providing an automated, AI-driven monitoring solution, the system empowers users to take timely protective actions, such as account deletion or notifying authorities, thereby enhancing personal security and supporting free expression.

## Objectives
- Develop an AI-driven platform for detecting social media threats against freedom of speech users.
- Utilise state-of-the-art NLP models for accurate text-based threat identification.
- Implement real-time data streaming and processing pipelines.
- Provide intuitive visualisations and customisable alerting mechanisms for diverse user needs.

## Key Features and Innovation
- Integration of Kafka-based event streaming with Oracle 26 AI database for scalable, high-performance threat analysis.
- DistilBERT-powered NLP models tailored to nuanced threat detection.
- Real-time threat indices and anonymised content visualisation to protect user privacy.
- Harassment network mapping to reveal coordinated threat campaigns.
- Ethical data handling and GDPR compliance.
- Customisable alert system aligned with user risk profiles and preferences.

## Optional Work May Apply to Future Use
- Expand threat detection capabilities to multimedia content such as images and videos.
- Integrate with law enforcement and support organisations for enhanced response.
- Improve multilingual and cross-cultural model robustness.

## API

### Add Bookmark
- **Endpoint:** `POST /bookmark/add`
- **Auth:** Requires `Authorization: Bearer <JWT>` header. The token must encode the user ID in the `sub` (or `id`) claim so the backend can associate the bookmark with the authenticated user.
- **Body:** JSON payload containing at least one of the following fields (all strings):
  ```json
  {
    "post_id": "POST_IDENTIFIER"
  }
  ```
  The backend also accepts `postId` or `processedId` for backward compatibility.
- **Behaviour:** The middleware validates the JWT, extracts `user_id`, and stores/updates the `(user_id, post_id)` pair in the `BOOKMARKS` table. The entry’s `updated_at` timestamp is refreshed and `is_deleted` is reset to `0`, effectively restoring soft-deleted bookmarks.
- **Response:** On success returns HTTP 201 with the persisted bookmark:
  ```json
  {
    "ok": true,
    "message": "Bookmark saved",
    "bookmark": {
      "BOOKMARK_ID": "...",
      "USER_ID": "...",
      "PROCESSED_ID": "...",
      "SAVED_AT": "...",
      "UPDATED_AT": "..."
    }
  }
  ```
  Failure cases return an error message and an appropriate HTTP status (400 for missing `post_id`, 401 for invalid JWT, 500 for server errors).
