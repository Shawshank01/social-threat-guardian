# Social Threat Guardian Frontend

This directory contains the React + TypeScript + Tailwind CSS frontend for **Social Threat Guardian**. It provides dashboards, authentication flows, and threat monitoring views that integrate with the backend APIs.

## Tech Stack

- **React 18** with TypeScript
- **Vite** for build tooling and dev server
- **React Router v6** for client-side routing
- **Tailwind CSS** for styling with custom dark mode theme

## Getting Started

```bash
cd frontend
npm install
npm run dev
```

The dev server runs at http://localhost:5173 by default. Use `npm run build` for a production bundle and `npm run preview` to serve the built assets locally.

## Environment Variables

For local development, create a `.env.development.local` file in the `frontend` directory:

```bash
BACKEND_URL=<your backend server ip/domain>
VITE_BACKEND_URL=<your backend server ip/domain>
```

### Variable Usage

- **`BACKEND_URL`** (server-side):
  - Used by Vite's dev server proxy in `vite.config.ts`
  - Proxies HTTP/HTTPS requests from `/api/*` routes to the backend server
  - Handles login, register, comments, and other HTTP/HTTPS API requests
  - **Required** for the Vite proxy to work

- **`VITE_BACKEND_URL`** (client-side):
  - Exposed to browser/client-side code (Vite automatically exposes variables prefixed with `VITE_`)
  - Used by `GaugeChart.tsx` to establish WebSocket (ws/wss) connections for real-time updates
  - Used by `HarassmentGraph.tsx` for direct API calls in production
  - **Required** for WebSocket connections and direct backend API calls from the browser

**Note:** Both variables should typically have the same value (the backend server URL). They serve different purposes:
- `BACKEND_URL`: server-side proxy (Node.js/Vite)
- `VITE_BACKEND_URL`: client-side code (browser JavaScript)

### Troubleshooting

- If HTTP/HTTPS requests fail: Check that `BACKEND_URL` is set correctly
- If WebSocket connections fail: Check that `VITE_BACKEND_URL` is set correctly
- Restart the dev server after creating or modifying `.env.development.local` (Vite only reads env files on startup)

## Key Features

### Authentication & Authorisation
- JWT-based authentication with token stored in `localStorage`
- Protected routes: `/dashboard`, `/settings`, `/bookmarks`, `/posts/:postId`
- Automatic redirect to login for unauthenticated users
- User session persistence across page refreshes

### Real-time Updates
- **WebSocket Integration**: `GaugeChart` component connects to backend WebSocket (`/ws`) for real-time hate score updates
- WebSocket URL is derived from `VITE_BACKEND_URL` (converts `https://` → `wss://`, `http://` → `ws://`)
- Automatic reconnection on connection loss

### Data Visualisation
- **Gauge Charts**: Real-time hate score visualisation using ApexCharts
- **Network Graphs**: Interactive harassment network visualisation using Cytoscape.js with force-directed layout (fcose)
- **Platform Cards**: Display high-risk content with severity indicators

### Version Management
- Automatic version detection on deployment
- Permanent update banner prompts users to reload when new version is available
- Version checks on app load, route changes, and every 5 minutes
- Cache-busting for `version.txt` to ensure fresh checks

### API Communication
- **Development**: Uses Vite proxy (`/api/*` to backend server via `BACKEND_URL`)
- **Production**: 
  - Most endpoints use Vercel serverless functions in `/api` directory
  - Some components (e.g., `HarassmentGraph`) call backend directly using `VITE_BACKEND_URL` to avoid serverless function limits from free plan on Vercel
- All API calls use `buildApiUrl()` utility for consistent URL construction

## Authentication

- Login and registration forms call `/api/login` and `/api/register` respectively
- Protected routes (`/dashboard`, `/settings`, `/bookmarks`, `/posts/:postId`) require authentication
- Token is stored in `localStorage` with key `stg.auth.token`
- User data is stored in `localStorage` with key `stg.auth.user`
- `ProtectedRoute` component handles route guarding and redirects to `/login` if not authenticated

## Styling

- **Tailwind CSS** powers the global design system
- **Dark mode** is class-based (`dark`) and controlled via `ThemeToggle` component
- User's theme preference is persisted in `localStorage`
- Custom theme colors defined in `tailwind.config.cjs`:
  - `stg-bg`: Dark background color
  - `stg-panel`: Panel/container background
  - Custom shadows and gradients
- Responsive design with mobile-first approach

## Deployment

### Vercel Deployment
- Frontend is deployed on Vercel with serverless functions in `/api` directory
- **Important**: Vercel has a limit of 12 serverless functions per deployment for the Hobby plan
- `vercel.json` configures:
  - SPA routing (all routes to `index.html`)
  - Cache headers (no-cache for HTML, immutable for assets)
  - Version file caching strategy

### Build Process
- `npm run build` compiles TypeScript and builds production bundle
- Build version is generated as timestamp and injected via `VITE_BUILD_VERSION`
- `version.txt` file is generated in `dist/` directory for version checking

### Environment Variables (Production)
- Set `BACKEND_URL` and `VITE_BACKEND_URL` in Vercel environment variables for production
- This is used by components that call the backend directly

## Important Notes for Developers

### API Endpoints
- **Development**: All `/api/*` requests are proxied to backend via Vite proxy
- **Production**: Most endpoints use serverless functions; some call backend directly
- Always use `buildApiUrl()` utility for constructing API URLs
- Check `vite.config.ts` for proxy rewrite rules

### WebSocket Connections
- WebSocket URL is constructed from `VITE_BACKEND_URL` in `GaugeChart.tsx`
- Protocol is automatically determined (https to wss, http to ws)
- WebSocket is only used for platforms hate score updates
- Connection automatically reconnects on failure

### State Management
- **Auth**: React Context (`AuthContext`) for authentication state
- **Theme**: React Context (`ThemeContext`) for dark/light mode
- **Local State**: Most components use `useState` and `useEffect` hooks
- No global state management library (Redux, Zustand, etc.), consider adding if complexity grows

### Type Safety
- TypeScript is strictly configured
- Type definitions in `src/types/` directory
- API responses should be typed when possible

### Performance Considerations
- Version check runs every 5 minutes and on route changes (production only)
- WebSocket connections are cleaned up on component unmount
- Large network graphs may impact performance, consider pagination or virtualisation

### Browser Compatibility
- Modern browsers with ES6+ support
- WebSocket support required for real-time features
- LocalStorage required for authentication persistence

## Troubleshooting

### Common Issues

1. **WebSocket connection fails**:
   - Check `VITE_BACKEND_URL` is set correctly
   - Verify backend WebSocket server is running
   - Check browser console for connection errors

2. **API requests fail in development**:
   - Verify `BACKEND_URL` is set in `.env.development.local`
   - Restart dev server after changing env variables
   - Check Vite proxy configuration in `vite.config.ts`

3. **Build fails**:
   - Run `npm install` to ensure dependencies are up to date
   - Check TypeScript errors: `npm run build` shows type errors
   - Verify all environment variables are set
