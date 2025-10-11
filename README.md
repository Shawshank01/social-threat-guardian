# Social Threat Guardian

## Background
Social media users often face targeted threats and harassment on social media platforms. This harassment may escalate to physical assault or assassination attempts during on-site activities. These threats can be either subtle or overwhelming, making them challenging to monitor and respond to effectively. An AI-powered system that detects and monitors such threats can support users by alerting them to potential risks and reminding them to alter their behaviour on social media if necessary.

## Motivation and Purpose
The Social Threat Guardian project was developed in response to the alarming rise in online harassment and real-world violence aimed at freedom of speech advocates. As threats have become more sophisticated and pervasive, the ability to detect them early and intervene quickly has become critical to preventing harm. The project provides an automated, AI-driven solution that detects potential threats early on, helping to safeguard individuals and uphold the principles of free expression. For example, when individuals realise that they have offended others with certain remarks and subsequently receive threats after revealing their true identity, they can either delete their accounts promptly to protect their personal security, or notify the relevant authorities immediately to seek protection.

## Objectives
- Develop an AI-driven system to detect social media threats against freedom of speech users.
- Utilize Natural Language Processing (NLP) techniques to analyze text-based threats.
- Incorporate visualization tools to monitor threat trends and patterns.
- Provide real-time alerts and comprehensive reports to users.

## Technical Approach
1. **Data Collection**
   - Gather social media data from platforms such as Reddit, Bluesky, Mastodon, Facebook, and Instagram using their APIs.
   - Complement API data with publicly available historical datasets of online content.
   - Use historical datasets for training and benchmarking models to better identify harmful content, while live API data supports real-time monitoring.

2. **Data Preprocessing**
   - Clean and normalize text data.
   - Remove spam and irrelevant content.
   - Annotate data for supervised learning.

3. **Threat Detection using NLP**
   - Implement text classification models to identify threatening language.
   - Use sentiment analysis and entity recognition to understand context.
   - Apply pre-trained or prompt-based NLP models on labeled datasets to ensure accuracy and reliability.

4. **Visualization Tools**
   - Develop dashboards to display threat levels, sources, and trends.
   - Use charts and graphs to represent data insights clearly.

5. **Alert System**
   - Set up real-time notifications for detected threats.
   - Allow users to customize alert preferences.

## Expected Outcomes
- The indicator allows users to quickly grasp the current status of social media.
- A functional AI system capable of detecting and monitoring social media threats.
- Enhanced safety and awareness for social media users.

## Key Features and Innovation
- AI-driven threat monitoring that leverages advanced NLP techniques for accurate detection of nuanced and emerging threats.
- Real-time threat index providing up-to-date risk assessments for users.
- Anonymized post visualization to protect privacy while offering clear insights into threat contents.
- Harassment network mapping to identify coordinated campaigns and key sources of threats.
- Ethical data handling practices ensuring user privacy and compliance with GDPR.
- Customizable alert system enabling users to tailor notifications based on their preferences and risk levels.

## Optional Work May Apply to Future Use
- Expand to include multimedia threat detection (images, videos).
- Integrate with law enforcement and support organizations.
- Improve model robustness across different languages and cultures.
