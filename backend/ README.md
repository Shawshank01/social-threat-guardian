
README.md

# Express WebPush + Oracle Autonomous DB Backend

This is a Node.js backend project built with **Express**, integrated with **Web Push Notifications** and **Oracle Autonomous Database** (using the thin driver + wallet).

---

## Prerequisites

- **Node.js 18+**
- **Oracle Autonomous Database** (with downloaded wallet)
- Oracle Wallet files stored **outside** the repo, and `TNS_ADMIN` pointing to that path.
- Generated VAPID keys for web push

---

## Installation

```bash
# Navigate to backend folder
cd backend

# Install dependencies
npm install


⸻

Environment Setup
	1.	Copy .env.example to .env:

cp .env.example .env


	2.	Fill in your Oracle DB credentials and wallet path:

ORACLE_USER=admin
ORACLE_PASSWORD=your_password
ORACLE_CONNECT_STRING=your_tns_alias_high
TNS_ADMIN=/absolute/path/to/your/oracle_wallet


	3.	Generate VAPID keys:

npx web-push generate-vapid-keys

Fill the generated keys into .env under VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.

⸻

Development

Start the development server with nodemon:

npm run dev

Or run directly:

node server.js

Server will start at:
👉 http://localhost:3000

⸻

Testing Database Connection

Use the built-in routes:
	•	GET /db/ping → returns DB time, name, and user
	•	GET /db/whoami → returns current DB user

If you see valid data returned, your Oracle wallet and environment variables are configured correctly ✅

⸻

Testing Web Push

Routes available under /push:
	•	GET /push/vapidPublicKey → returns public VAPID key
	•	POST /push/subscribe → save a subscription
	•	POST /push/send → send a notification to a specific subscription
	•	POST /push/broadcast → broadcast to all saved subscriptions

⸻

Production Deployment
	•	Set environment variables securely (never commit .env).
	•	Place Oracle Wallet in a secure, non-repo path.
	•	Run with a process manager like pm2 or in Docker.
	•	Serve static assets from /public for service workers if using web push.

⸻

