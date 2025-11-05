# Social Threat Guardian – Weekly Retrospective 3
## **Regular Schedule:** Every Sunday before 18:00

**Team Name:** Zero cool  
**Team member:** Diwen Xiao, Denis Muriuki, Mingde Zhou  
**Period Covered:** Mon 20 Oct – Sun 26 Oct

---

## **Overview**
This week's works focus on frontend and backend connection on deployment, apache Kafka and apache Spark configuration. Until now, team has finished deployment on Vercel(Frontend) and Oracle Linux VM(backend), also team has finished further data training. During development, user privacy and data ethics are considered.

During this week, the team continued improving the connection between the backend and the database, finalised VM setup on Oracle Cloud for Kafka and Spark, and strengthened repository management to prevent unreviewed merges. Mentor meetings addressed API cost constraints, backend–database integration issues, and overall coordination on the interim report.

---

## **What Went Well**
- **Presentation Tier Deployment:** Finished the deployemnt, research available and compatable software on market place, then choose Vercel as ideal frontend deployment tools, modified frontend code to adjust backend on VM. 
- **Logic Tier Deployment:** Create new empty VM on Oracle, download dependencies and install tools for manage and run backend code, then open the firewall adn ACL, expose a port for frontend to send request. Use pm2 to run backend 24/7 and restart backend once VM is open.

- **Oracle VM Setup and Coordination:** Successfully configured two Oracle Cloud virtual machines for Kafka and Spark. Solved firewall setup, ensuring proper connectivity for backend and AI data flow.  
- **Frontend Input Validation:** Implemented validation functions in the registration and login pages, preventing users from submitting incorrect input formats, improving usability and data integrity.  
- **Index Gauge Refinement:** Improved index label and scale alignment on the gauge display by adjusting dual semicircular radius layout, creating smoother visual integration.  
- **Repository Management:** Implemented GitHub protection rules requiring reviews before merges, ensuring higher code quality and better collaboration.  

---

## **Challenges / What Could Be Improved**
- **CI/CD** Deployment can be continuously finished and running, no need to fetch code from github and run start script everytime.  
- **Firewall/Port Setting** Setting access control list and firewall on VM to open port for frontend, this take team lot of time.  
- **API Access Limitation:** High costs for official APIs continue to hinder real-time data collection, requiring alternative solutions such as third-party or academic access options.  

---

## **Lessons Learned**
- Render is good for setting up backend deployment, but for connection wallet, it can't be added in, so either use name/password to connect or use VM for deployment.
- Pm2 can be used for load balancer, keep project running while close terminal, keep running when upgrade and pull new code, set script for managing project.  
- Ensuring consistent contribution and accountability within the team is vital to avoid work imbalance during key deliverables like the interim report.  
- Setting up firewall and VM connections can take longer than expected; early collaboration prevents delays in backend setup.  

---

## **Next Steps**
- Implement more backend functions like setting keywords, and fetch hate comments in database and send back for specific users.
- Develop user preference and keyword settings, send request back to logic tier, logic tier will select specific language hate comment with keywords.
- Explore affordable or academic APIs to enable real-time data extraction.  
- Maintain clear task distribution and weekly progress checks to prevent workload imbalance.  

---

**Reflection:**  
Week 4 represented further code developing and model training, team set deployment and model configuration as priority, to make fundation for future development. After intrim report we received feedback from mentors, and adjust development of core functions and presentation functions. There is still some diffculty on model settings and logic tier, but they will be solved in the future.
Additionally, this week underscored the importance of team accountability and technical collaboration. Despite challenges in workload balance and limited API access, the team achieved stable infrastructure setup and implemented several crucial frontend and repository improvements. These steps created a solid foundation for upcoming integration between backend, frontend, and AI tiers.
