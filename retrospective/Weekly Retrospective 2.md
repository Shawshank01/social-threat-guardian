# Social Threat Guardian – Weekly Retrospective 2
## **Regular Schedule:** Every Sunday before 18:00

**Team Name:** Zero cool  
**Team member:** Diwen Xiao, Denis Muriuki, Mingde Zhou  
**Period Covered:** Sun 13 Oct – Sun 19 Oct

---

## **Overview**
This week marked the transition from conceptual and design stages into substantial technical implementation. The team began integrating backend and frontend components, refining the system architecture, and enhancing repository workflow governance. Additionally, major discussions took place concerning data ethics, model training feasibility, and the balance between user protection and data legality.

---

## **What Went Well**
- **Improved Version Control Workflow:** A repository rule was successfully introduced to prevent unreviewed pull requests from being merged into the main branch. This ensures higher code quality and eliminates redundant rollback efforts.  
- **Feature Development:** The login and registration frontend was implemented according to the system contract. A blur function was also added to the homepage to protect users from encountering offensive posts unexpectedly.  
- **Database Design:** The first complete ER diagram was produced, providing a structured foundation for backend data storage and user preference management.  
- **System Architecture & Flowchart:** The flowchart derived from the N-tier system design was finalised and optimised. This clarified Kafka’s position in the processing pipeline and strengthened communication between frontend and backend planning.  
- **Effective Collaboration:** Team discussions about data engineering responsibilities resulted in more balanced task distribution. The mentor’s suggestion led to shared data tasks and better clarity of backend priorities.
- **DistillBERT:** Model training, dataset cleaning and dataset splitting went well with minor changes to minimize training time.
- **database:** Create oracle 26ai atonomous database and link the backend to it, create table of register/login user, test connection well
- **backend:** Develop backend features, including web push service, login/register function, and connection test of database, solve the problem of oracle wallet with Brendan.
- **System architecture:** Research system architecture, and adjust number of tiers in our system based on feedback mentors gave us. Draw the system architecture diagram.

---

## **Challenges / What Could Be Improved**
- **Model Complexity:** Determining a reliable method for calculating the “threat index” remains challenging. Training an AI model to quantify threat levels proved infeasible at this stage, meaning the backend must assume greater responsibility for computing this logic.  
- **Data Ethics Debate:** Differing opinions arose over whether to use synthetic or fabricated data for testing doxxing-related features. While the issue was resolved ethically, it reflected ongoing tension between functional ambition and compliance risk.  
- **Technical Integration:** The lack of a fully functional backend API hindered frontend testing for features like registration and login. Closer coordination will be needed to synchronise API endpoints and frontend components.
- **Database connection:** This problem wasted me more than 4 to 5 days, and finally disabled mTLS to connect successfully.
- **DistillBERT tier handling:** Have little knowledge on AI tier, still finding ways to help teammates finish their work.

---

## **Lessons Learned**
- Establishing repository governance early prevents future errors and saves significant recovery time.  
- Backend logic should complement model limitations instead of over-relying on AI capabilities.  
- Ethical considerations must remain at the centre of design decisions, particularly when dealing with sensitive or personal data.  
Using deployment tools to manage our frontend and backend is good decision, but concerning about changing absolute path of some environment files to is also important.
---

## **Next Steps**
- Implement the backend logic for calculating and displaying the threat index based on model classification outputs.  
- Integrate the database ER diagram with backend APIs to enable real data operations.  
- Begin exploring the use of **Apache Spark** and **Kafka Cloud Services** for improved scalability.  
- Continue refining the front-end UI/UX while maintaining ethical design principles, including user protection and data transparency.  
- Maintain regular reviews and streamlined communication to ensure consistent progress across all technical components.
- Link backend to frontend and deploy both.


---

**Reflection:**  
Week 3 represented a turning point for *Social Threat Guardian*, with the project moving from planning to tangible development. The team demonstrated adaptability in addressing workflow issues, ethical dilemmas, and technical challenges. While difficulties emerged in integrating AI and backend systems, the team showed strong collaboration and resilience. With clearer structure, improved governance, and ongoing mentor feedback, the foundation is now set for accelerating technical development in the next sprint and delivering the upcoming interim presentation and report.  

---
