# Social Threat Guardian

## Introduction
Social Threat Guardian is an AI-powered platform designed to detect, monitor, and visualise harmful content and harassment networks across social media. Its goal is to provide users with clear, accessible, and highly visual tools that help them quickly assess the tone, safety, and overall hostility level of online environments.

By combining advanced Natural Language Processing (NLP), real-time or near–real-time data ingestion, and intuitive dashboard-style visualisations, the system identifies trends such as rising hate speech, coordinated harassment, or radical shifts in public sentiment. These insights are presented in a simple and user-friendly interface, enabling users to make informed decisions about online engagement, personal safety, and offline event planning.

Ultimately, Social Threat Guardian aims to deliver early warning signals and actionable intelligence without overwhelming the user, empowering both casual observers and high-risk individuals to better understand evolving social media dynamics.

## Target Users
- **General Social Media Users:** Seek awareness of the overall threat environment and platform sentiment without requiring account registration.
- **Registered Users:** Require customisable monitoring by keywords and languages, real-time alerts, and detailed content analysis to manage personal safety.
- **Security Analysts and Moderators:** Utilise harassment network visualisations and threat indices to understand coordinated campaigns and emerging risks for informed intervention.

## Technical Approach
1. **Data Ingestion**
   - Collect data from social media platforms (Bluesky for now, Mastodon and Telegram later) via their APIs.
   - Supplement live data streams with historical datasets in CSV and JSON formats.
   - Employ Apache Kafka and Spark for event-driven streaming and real-time data pipeline management.

2. **AI Processing**
   - Apply DistilBERT-based NLP models for text classification, sentiment analysis, and entity recognition to identify threatening language and context.
   - Process data within an Oracle 26 ai database to leverage in-database machine learning and enhance performance.

3. **Backend Orchestration**
   - Use Express to coordinate data flow, model inference, and user request handling.
   - Integrate Kafka consumers and producers for seamless data streaming and event processing.

4. **Frontend Visualisation**
   - Develop a React and TypeScript-based user interface.
   - Provide dashboards displaying threat index, latest hateful post content, threat trend and harassment network maps.
   - Users who are logged in have access to more functionalities, such as bookmarks and leave comments.

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
The Social Threat Guardian project responds to the increasing sophistication and prevalence of online harassment targeting freedom of speech advocates. Early detection and intervention are critical to preventing harm and maintaining open discourse. By providing an automated, AI-driven monitoring solution, the system empowers users to take timely protective actions, such as account deletion or notifying authorities, thereby enhancing personal security.

## Key Features and Innovation
- Integration of Kafka-based event streaming with Oracle 26 AI database for scalable, high-performance threat analysis.
- DistilBERT-powered NLP models tailored to nuanced threat detection.
- Real-time threat indices and treat trend history.
- Harassment network mapping to reveal coordinated threat campaigns.
- Ethical data handling and GDPR compliance.
- Customisable alert system aligned with user preferences.

## Optional Work May Apply to Future Use
- Expand threat detection capabilities to multimedia content such as images and videos.
- Integrate with law enforcement and support organisations for enhanced response.
- Improve multilingual and cross-cultural model robustness.
- Develop mobile application clients, integrating with APNs (Apple Push Notification Service) or FCM (Firebase Cloud Messaging).
- Add email push functionality.
- Expand support for more social media platforms​.
