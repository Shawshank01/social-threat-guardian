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

## 3. Backend API endpoint

### Register
- `POST /auth/register` (also available as `/api/register`)
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "atLeast8Chars",
    "name": "Optional display name"
  }
  ```
- **Responses:**
  - `201 Created`
    ```json
    {
      "ok": true,
      "user": {
        "ID": 123,
        "EMAIL": "user@example.com",
        "NAME": "Optional display name",
        "LAST_LOGIN_AT": "2024-01-01T12:34:56.000Z"
      }
    }
    ```
  - `400 Bad Request` when email/password are missing or invalid format/length.
  - `409 Conflict` when the email is already registered.
  - `500 Internal Server Error` for unexpected issues.
- **Example:**
  ```bash
  curl -X POST http://localhost:3000/auth/register \
       -H "Content-Type: application/json" \
       -d '{"email":"user@example.com","password":"secret123","name":"User"}'
  ```
### Login
- `POST /auth/login` (also available as `/api/login`)
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "secret123"
  }
  ```
- **Responses:**
  - `200 OK`
    ```json
    {
      "ok": true,
      "id": "user-uuid",
      "token": "jwt-token-string",
      "expiresIn": "1h",
      "user": {
        "id": "user-uuid",
        "email": "user@example.com",
        "name": "Optional display name"
      }
    }
    ```
  - `400 Bad Request` when email/password are missing.
  - `401 Unauthorized` when credentials are invalid.
  - `500 Internal Server Error` for unexpected issues.
  - The response user id is same as user table id, for tracking user preference 
- **Example:**
  ```bash
  curl -X POST http://localhost:3000/auth/login \
      -H "Content-Type: application/json" \
       -d '{"email":"user@example.com","password":"secret123"}'
  ```

### Logout
- `POST /auth/logout` (also available as `/api/logout`)
- **Headers:** `Content-Type: application/json` (optional) and optionally `Authorization: Bearer <token>`
- **Request Body (optional):**
  ```json
  {
    "token": "jwt-token-string"
  }
  ```

### Bookmarks
- All bookmark endpoints require `Authorization: Bearer <jwt>` and parse `user_id` via `requireAuth`.

#### Add Bookmark
- `POST /bookmark/add`
- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <jwt>`
- **Request Body:**
  ```json
  {
    "post_id": "target-post-id"
  }
  ```
- **Responses:**
  - `201 Created`
    ```json
    {
      "ok": true,
      "bookmark": {
        "BOOKMARK_ID": "generated-guid",
        "USER_ID": "user-uuid",
        "PROCESSED_ID": "target-post-id",
        "SAVED_AT": "2024-01-01T12:34:56.000Z",
        "UPDATED_AT": "2024-01-01T12:34:56.000Z"
      }
    }
    ```
  - `400 Bad Request` when `post_id` is missing.
  - `409 Conflict` if the user already bookmarked the post.
  - `500 Internal Server Error` for unexpected failures.

#### Remove Bookmark
- `DELETE /bookmark/remove`
- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <jwt>`
- **Request Body:**
  ```json
  {
    "post_id": "target-post-id"
  }
  ```
- **Responses:**
  - `200 OK`
    ```json
    {
      "ok": true,
      "removed": 1
    }
    ```
  - `400 Bad Request` when `post_id` is missing.
  - `404 Not Found` if the bookmark does not exist.
  - `500 Internal Server Error` for unexpected failures.
- **Example:**
  ```bash
  curl -X DELETE http://localhost:3000/bookmark/remove \
       -H "Content-Type: application/json" \
       -H "Authorization: Bearer <jwt>" \
       -d '{"post_id":"post-123"}'
  ```

#### List Bookmarks
- `GET /bookmark`
- **Headers:** `Authorization: Bearer <jwt>`
- **Responses:**
  - `200 OK`
    ```json
    {
      "ok": true,
      "count": 2,
      "bookmarks": [
        {
          "BOOKMARK_ID": "guid-1",
          "USER_ID": "user-uuid",
          "PROCESSED_ID": "post-1",
          "SAVED_AT": "2024-01-01T12:34:56.000Z",
          "UPDATED_AT": "2024-01-01T12:34:56.000Z"
        }
      ]
    }
    ```
  - `500 Internal Server Error` for unexpected failures.
- **Responses:**
  - `200 OK`
    ```json
    {
      "ok": true
    }
    ```
  - `400 Bad Request` when an invalid (non-JWT) token is supplied.
  - `500 Internal Server Error` for unexpected issues.
- **Example:**
  ```bash
  curl -X POST http://localhost:3000/auth/logout \
       -H "Authorization: Bearer <token>"
  ```

### Notifications
- All endpoints require `Authorization: Bearer <jwt>`; `requireAuth` uses that token to populate `req.user.id`.

#### List notifications
- `GET /notifications`
- **Query:** `limit` (default 20, max 100), `offset` (default 0), `unreadOnly=true|false`
- **Response:**
  ```json
  {
    "ok": true,
    "data": [
      {
        "id": "NOTI123",
        "userId": "42",
        "type": "SYSTEM",
        "message": "Hate score breached threshold",
        "createdAt": "2024-03-12T08:00:00.000Z",
        "readStatus": false
      }
    ]
  }
  ```

#### Unread count
- `GET /notifications/unread-count`
- **Response:**
  ```json
  {
    "ok": true,
    "data": { "count": 3 }
  }
  ```

#### Mark a single notification as read
- `POST /notifications/:id/read`
- **Response:** `{ "ok": true, "data": { "updated": true } }`

#### Mark all notifications as read
- `POST /notifications/read-all`
- **Response:** `{ "ok": true, "data": { "updatedCount": 5 } }`

After login, the frontend can poll `unread-count` to display the badge, fetch the list when the notification drawer opens, and then call `read`/`read-all` once the user views the items.

### Update Email
- `PUT /users/email`
- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <token>`
- **Authentication:** `requireAuth.js` validates the JWT and injects `req.user.id`, so the body only needs the target email.
- **Request Body:**
  ```json
  {
    "email": "new-email@example.com"
  }
  ```
  (Email format validation happens on the frontend.)
- **Responses:**
  - `200 OK`
    ```json
    {
      "ok": true,
      "user": {
        "id": "user-uuid",
        "email": "new-email@example.com"
      }
    }
    ```
  - `400 Bad Request` when `email` is missing.
  - `401 Unauthorized` when the JWT is missing/invalid.
  - `404 Not Found` if the authenticated user no longer exists.
  - `409 Conflict` if the new email already exists (`ORA-00001`).
  - `500 Internal Server Error` for unexpected issues.
- **Example:**
  ```bash
  curl -X PUT http://localhost:3000/users/email \
       -H "Content-Type: application/json" \
       -H "Authorization: Bearer <token>" \
       -d '{"email":"new-email@example.com"}'
  ```

### Update Name
- `PUT /users/name`
- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <token>`
- **Authentication:** `requireAuth.js` validates the JWT and injects `req.user.id`, so the body only needs the new `name` value.
- **Request Body:**
  ```json
  {
    "name": "New Display Name"
  }
  ```
- **Responses:**
  - `200 OK`
    ```json
    {
      "ok": true,
      "user": {
        "id": "user-uuid",
        "name": "New Display Name"
      }
    }
    ```
  - `400 Bad Request` when `name` is missing or empty.
  - `401 Unauthorized` when the JWT is missing/invalid.
  - `404 Not Found` if the authenticated user no longer exists.
  - `500 Internal Server Error` for unexpected issues.
- **Example:**
  ```bash
  curl -X PUT http://localhost:3000/users/name \
       -H "Content-Type: application/json" \
       -H "Authorization: Bearer <token>" \
       -d '{"name":"New Display Name"}'
  ```

### Update Password
- `PUT /users/password`
- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <token>`
- **Authentication:** `requireAuth.js` validates the JWT and injects `req.user.id`, so the body only needs the new plain-text password.
- **Request Body:**
  ```json
  {
    "password": "atLeast8Chars"
  }
  ```
- **Responses:**
  - `200 OK`
    ```json
    {
      "ok": true,
      "message": "password updated"
    }
    ```
  - `400 Bad Request` when the password is missing or shorter than 8 characters.
  - `401 Unauthorized` when the JWT is missing/invalid.
  - `404 Not Found` if the authenticated user no longer exists.
  - `500 Internal Server Error` for unexpected issues.
- **Example:**
  ```bash
  curl -X PUT http://localhost:3000/users/password \
       -H "Content-Type: application/json" \
       -H "Authorization: Bearer <token>" \
       -d '{"password":"atLeast8Chars"}'
  ```

### Save User Preferences
- `POST /user-preferences`
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Authentication:** The server derives the `userId` from the JWT payload, so the body only needs the preference data.
- **Request Body:**
  ```json
  {
    "languages": ["en"],
    "keywords": ["trump", "election"]
  }
  ```
  - `languages`/`language` and `keywords`/`keyword` accept either a single string or an array, and the backend trims empty values before storing them as JSON arrays.
- **Responses:**
  - `200 OK`
    ```json
    {
      "ok": true,
      "message": "User preferences saved",
      "preferences": {
        "id": "pref-uuid",
        "userId": "user-uuid",
        "languages": ["en"],
        "keywords": ["trump", "election"],
        "createdAt": "2024-01-01T12:34:56.000Z",
        "updatedAt": "2024-01-01T12:34:56.000Z"
      }
    }
    ```
  - `401 Unauthorized` when the JWT is missing or invalid.
  - `500 Internal Server Error` for unexpected issues.
- **Example:**
  ```bash
  curl -X POST http://localhost:3000/user-preferences \
       -H "Authorization: Bearer <token>" \
       -H "Content-Type: application/json" \
       -d '{"language":"en","keywords":["trump"]}'
  ```
### Fetch User Preferences
- `GET /user-preferences`
- **Headers:** `Authorization: Bearer <token>`
- **Description:** Returns the authenticated user’s keyword and language preferences. If no record exists yet, the response falls back to empty arrays so the UI can render a default state.
- **Successful Response (`200 OK`):**
  ```json
  {
    "ok": true,
    "preferences": {
      "userId": "user-uuid",
      "keywords": ["trump", "election"],
      "languages": ["en", "es"]
    }
  }
  ```
- **Errors:**
  - `401 Unauthorized` when the JWT is missing or invalid.
  - `500 Internal Server Error` for unexpected issues.
- **Example:**
  ```bash
  curl http://localhost:3000/user-preferences \
       -H "Authorization: Bearer <token>"
  ```
### Fetch User Preferences (body-based)
- `POST /user-preferences/get`
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Request Body:** Optional (may be `{}`); the server still uses the JWT for user identification.
- **Successful Response (`200 OK`):**
  ```json
  {
    "ID": "pref-uuid",
    "KEYWORDS": ["trump", "election"],
    "LANGUAGES": ["en", "es"]
  }
  ```
  - Returns an empty object (`{}`) when no preferences exist for the authenticated user.
- **Errors:**
  - `401 Unauthorized` when the JWT is missing or invalid.
  - `500 Internal Server Error` for unexpected issues.
- **Example:**
  ```bash
  curl -X POST http://localhost:3000/user-preferences/get \
       -H "Authorization: Bearer <token>" \
       -H "Content-Type: application/json" \
       -d '{}'
  ```
### Search Comments by Keyword
- `POST /comments/search` (body: `{ "keywords": ["foo", "bar"], "limit": 4, "predIntent": "HARMFUL", "source": "BLUSKY_TEST" }`)  
- **Description:** For each keyword provided, queries the database for comments whose `POST_TEXT` contains that keyword (case-insensitive) and returns up to `limit` matches per keyword. Results come from the chosen table (`source`, default `BLUSKY_TEST`) and default to `PRED_INTENT = 'HARMFUL'` unless overridden. Each comment includes a user-friendly `platform` label, a `postUrl` that links back to the original post, and a human-readable `timeAgo`.
- **Request Body:**
  ```json
  {
    "keywords": ["hate speech", "alert"],
    "limit": 4,
    "predIntent": "HARMFUL",
    "source": "BLUSKY_TEST"
  }
  ```
- **Example (curl):**
  ```bash
  curl -X POST http://localhost:3000/comments/search \
       -H "Content-Type: application/json" \
       -d '{"keywords":["hate","alert"],"limit":4,"source":"BLUSKY2"}'
  ```
- **Response:**
  ```json
  {
    "ok": true,
    "platform": "BLUSKY2",
    "keywordCount": 2,
    "results": [
      {
        "keyword": "hate",
        "count": 3,
        "comments": [
          {
            "postText": "text mentioning hate",
            "predIntent": "HARMFUL",
            "platform": "BLUSKY2",
            "hateScore": ".9999",
            "postUrl": "https://blusky.example/posts/12345",
            "timeAgo": "12 mins ago"
          }
        ]
      },
      {
        "keyword": "alert",
        "count": 0,
        "comments": []
      }
    ]
  }
  ```
### Fetch Latest Comments
- `GET /comments/latest` (optional `?limit=4&predIntent=HARMFUL&source=BLUSKY_TEST`)  
- **Description:** Returns the newest comments from the requested table (`source`, defaults to `BLUSKY_TEST`), ordered by `POST_TIMESTAMP` descending. Defaults to `PRED_INTENT = 'HARMFUL'`, but you can pass `predIntent` to override. Each comment includes a friendly `platform` label, a navigable `postUrl`, and a human-readable `timeAgo`.
- **Example (curl):**
  ```bash
  curl "http://localhost:3000/comments/latest?limit=4"
  curl "http://localhost:3000/comments/latest?limit=4&predIntent=HATE_SPEECH"
  curl "http://localhost:3000/comments/latest?limit=4&source=BLUSKY2"
  ```
- **Response:**
  ```json
  {
    "ok": true,
    "count": 4,
    "platform": "BLUSKY2",
    "comments": [
      {
        "postText": "text mentioning hate",
        "predIntent": "HARMFUL",
        "platform": "BLUSKY2",
        "postUrl": "https://blusky.example/posts/12345",
        "timeAgo": "12 mins ago"
      }
    ]
  }
  ```
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

### Real-time Hate Score Monitor
- **Overview:** A background task (`hateScoreMonitor`) runs every 30 seconds, pulls the latest 100 rows from `BLUSKY_TEST`, filters valid `HATE_SCORE` values, and broadcasts the average score plus metadata to all connected WebSocket clients. This service starts automatically with `server.js`.
- **Connection:** `ws://<host>:3000/ws`
- **Message Types:**
  - `CONNECTED`: sent once per client after the handshake (contains `connectedAt` ISO timestamp).
  - `HATE_SCORE_UPDATE`: emitted after each poll with the following payload:
    ```json
    {
      "type": "HATE_SCORE_UPDATE",
      "data": {
        "value": 0.8123,
        "updatedAt": "2025-01-15T08:30:00.123Z",
        "sampleSize": 97,
        "tableName": "BLUSKY_TEST"
      }
    }
    ```
  - `PONG`: response when the client sends `{ "type": "PING" }`, useful for keep-alive logic.
- **Client Expectations:** Subscribe once, update UI whenever `HATE_SCORE_UPDATE` arrives, and optionally send `PING` messages if your environment requires heartbeats. No additional authentication is enforced today; add middleware if required for production.

### Harassment Network Cliques
- **Endpoint:** `GET /harassment-network/cliques`
- **Description:** Executes an Oracle `GRAPH_TABLE` query against `DIWEN.HARASSMENT_NETWORK` to find 3-person harassment cycles (A→B, B→C, C→A). Useful for drawing network graphs on the frontend. Supports light parameterization so dashboards can control payload size.
- **Query Parameters:**
  - `limit` (optional, default `100`, max `500`): caps the number of cliques returned.
  - `table` or `source` (optional, default `DIWEN.HARASSMENT_NETWORK`): override the graph view name. Value must be uppercase alphanumeric/underscore/dot (e.g., `SCHEMA.GRAPH_VIEW`).
- **Successful Response (`200 OK`):**
  ```json
  {
    "ok": true,
    "nodes": [{ "id": "did:user:a" }, { "id": "did:user:b" }],
    "links": [
      { "source": "did:user:a", "target": "did:user:b" },
      { "source": "did:user:b", "target": "did:user:c" },
      { "source": "did:user:c", "target": "did:user:a" }
    ],
    "cliques": [
      { "USER_A": "did:user:a", "USER_B": "did:user:b", "USER_C": "did:user:c" }
    ],
    "limit": 100,
    "tableName": "DIWEN.HARASSMENT_NETWORK"
  }
  ```
- **Errors:** Returns `400` for invalid parameters (e.g., malformed table name) or `500` when Oracle queries fail.
- **Example:**
  ```bash
  curl "http://localhost:3000/harassment-network/cliques?limit=75"
  ```
