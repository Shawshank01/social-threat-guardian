## Connection frontend

1. **.env**  
   # .env
    copy env file to source directory of backend
PORT=3000

TNS_ADMIN=your/path/oracle_wallet

ORACLE_USER=ADMIN
ORACLE_PASSWORD=!Zmdsnd06200
ORACLE_CONNECT_STRING=tud26ai_tp

# Optional connection pool settings
DB_POOL_MIN=0
DB_POOL_MAX=4
DB_POOL_INC=1
DB_QUEUE_TIMEOUT=60000

# Web Push VAPID Keys
VAPID_EMAIL=mailto:mindezhou1@outlook.com
VAPID_PUBLIC_KEY= BNMSSYvWlbE3XO0msO0p5oaA9rmqexO-gZQ2kRnQaUHCz1Q5JWUvgfGJvna1QxSVbTz9a27oQPu1EfJ_IBZzjvs
VAPID_PRIVATE_KEY= q33oRIq2bMv_6l6kvqg2xv7TF_eH8_QsS7KdVuvsGW4


# Debugging
DEBUG=true


#jsonwebtoken
#run command in term: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=yf3ccd7d15701282dd88a43b50ffa072372e8430b65c4cbb0fec3df9ad03915c8f49ce7a0e223edd74f13701c484dd7244ab77577b269c9d2a7d2fcf83035ae2d
JWT_EXPIRES_IN=24node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

#JWT expires in
JWT_EXPIRES_IN=24h

# Cors
CORS_ALLOW_ORIGINS=http://localhost:5173,https://social-threat-detection.vercel.app


1. **download wallet**

   path= backend/oracle_wallet

2. **Install dependencies**  

   cd backend
   npm install


5. **Enable CORS** (required for requests from `https://*.vercel.app` to `http://localhost:3000`). Add  and middleware:

   // server.js
   import cors from "cors";

   const allowedOrigins = [
     "http://localhost:5173",
     "http://127.0.0.1:5173",
     "https://vercel.domain",
   ];

   app.use(
     cors({
       origin: allowedOrigins,
       credentials: true,
     })
   );

   Replace `<vercel.domain>` with the deployed URL.
6. **Start the server**

   npm run dev 

7. **Login/Register test endpoints**  

   curl http://localhost:3000/health
   curl http://localhost:3000/auth/register --data '{"email":"test@example.com","password":"secret123"}' \
        -H "Content-Type: application/json"

## 2. Frontend Configuration

1. **Expose the backend URL**  

   Commit a `.env.example` with `VITE_API_BASE_URL=http://localhost:3000` so the team has a template.

2. **Use the base URL in fetch calls**  
3. 
   Update API helpers to read from the environment variable:
   ```ts
   const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

   export async function login(body: LoginPayload) {
     const response = await fetch(`${API_BASE}/auth/login`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify(body),
     });
     // ...
   }
   ```
   Repeat for `/auth/register`, `/push/*`, `/db/ping`, and the gauge endpoint (see below).


3. **Local Vite proxy (optional)**  
   For local development you can let Vite proxy `/api` requests:

   // vite.config.ts
   server: {
     port: 5173,
     proxy: {
       "/api": {
         target: "http://localhost:3000",
         changeOrigin: true,
         rewrite: (path) => path.replace(/^\/api/, ""),
       },
     },
   },

   Then your React code can keep using `/api/...` during dev while the production build uses `VITE_API_BASE_URL`.

4. **Deploying on Vercel**  
   - Set `VITE_API_BASE_URL` (Environment Variables → Production) to `http://127.0.0.1:3000`.  
   - Re-deploy the frontend.
   - When you open the Vercel URL on the same machine that runs the backend, the browser will talk to `http://127.0.0.1:3000`. Other users need their own backend instance or a publicly reachable API.

