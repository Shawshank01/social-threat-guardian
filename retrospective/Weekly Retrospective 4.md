# Social Threat Guardian – Weekly Retrospective 4
## **Regular Schedule:** Every Sunday before 18:00

**Team Name:** Zero cool  
**Team member:** Diwen Xiao, Denis Muriuki, Mingde Zhou  
**Period Covered:** Mon 27 Oct – Sun 2 Nov

---

## **Overview**
This week was marked by both major breakthroughs and serious communication challenges. Early in the week, backend integration issues led to a significant team conflict, but through direct discussion, the team resolved the issue and achieved full communication between the frontend, backend, and database. The project reached an important technical milestone: seamless data flow across all tiers, both locally and on the live site. Meanwhile, efforts were made to strengthen data engineering components, expand content sources through Bluesky and Mastodon. The week concluded with improved system stability and enhanced collaboration across technical components.

---

## **What Went Well**
- **System Integration Achieved:** Frontend, backend, and database now communicate smoothly across both local and online deployed environments which is Vercel, marking a major technical milestone.  
- **Oracle Cloud & Security Improvements:** Backend IP addresses were secured using environment variables to prevent exposure in the public repository.  
- **Mastodon API Implementation:** Successfully developed a Python script to retrieve trending posts from the Mastodon API, establishing a new content source that reflects real platform activity.  
- **Bluesky API Implementation:** Successfully developed a Python script to retrieve posts from the Bluesky API.  
- **Kafka & Spark Pipeline Testing:** Tested Kafka topic monitoring and experimented with Spark data consumption scripts to evaluate system scalability.  
- **Bluesky Real Data Processing and Storage:** The system can now retrieve raw data from Bluesky in the backend, process it through Kafka and Spark, send it to AI for processing, and store the processing results in Oracle DB.  
- **Evaluation Design:** Designed an evaluation scenario for the Index Gauge targeting parents, focusing on trust, usability, and perceived usefulness.  
- **Frontend Enhancements:** Added icons and a favicon to improve visual presentation and user interface consistency.  
- **Conflict Resolution & Collaboration:** Despite strong disagreements early in the week, the team communicated directly, clarified responsibilities, and restored effective collaboration.

---

## **Challenges / What Could Be Improved**
- **Backend Quality & Documentation:** The backend initially lacked proper API documentation, contained test URLs unrelated to deployment, and was not accessible from cloud servers. These issues caused significant delays and frustration.  
- **Team Communication:** Miscommunication led to a breakdown in trust early in the week, better status updates and more consistent peer review are needed.  
- **Spark Necessity:** The inclusion of Spark remains under review. Although deployed successfully, its necessity for the current data volume remains questionable.  

---

## **Lessons Learned**
- Direct, honest communication, though difficult, is sometimes necessary to resolve recurring technical and collaboration issues.  
- System integration success depends on shared understanding and clear backend documentation.  
- Collaboration can only thrive when all members take ownership of their assigned responsibilities.  
- Simplifying architecture should always be considered before adding complex components like Spark unless data scale justifies it.  

---

## **Next Steps**
- Strengthen backend documentation and clarify endpoint responses for consistent frontend communication.  
- Continue refining the data pipeline between Kafka, Spark, and Oracle to ensure reliability.  
- Begin data ingestion testing with Mastodon and consider integrating additional platforms later.  
- Conduct the parent-based Index Gauge evaluation to gather user feedback on its design and clarity.  
- Improve internal communication by scheduling short daily updates to prevent misunderstandings.  

---

**Reflection:**  
Week 4 demonstrated both the difficulties and rewards of teamwork under pressure. Despite the conflict surrounding backend delivery and documentation, the team managed to overcome major obstacles and achieve main backend system functionality. Next week, the team will focus on completing the system's full functions and enabling users to interact with it, and conduct user experience evaluations based on this.
