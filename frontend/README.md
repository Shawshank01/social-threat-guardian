# Social Threat Guardian Frontend

This directory contains the React + TypeScript + Tailwind CSS frontend for **Social Threat Guardian**. It provides dashboards, authentication flows, and threat monitoring views that integrate with the backend APIs.

## Getting Started

```bash
cd frontend
npm install
npm run dev
```

The dev server runs at http://localhost:5173 by default. Use `npm run build` for a production bundle and `npm run preview` to serve the built assets locally.

## Environment Variables

The frontend expects the backend API at the same origin by default. If the API is hosted elsewhere during development, configure Vite's dev server proxy in `vite.config.ts` or use a custom environment variable (e.g., `VITE_API_BASE_URL`) and reference it in your fetch calls.

## Authentication Notes

- Login and registration forms call `/api/login` and `/api/register` respectively.
- A temporary test account (`a@b.com` / `123qwe`) is available for QA; remove the stub in `src/context/AuthContext.tsx` when backend auth is ready.
- Protected routes (`/dashboard`, `/settings`) require a token. Update `ProtectedRoute` if the backend semantics change.

## Styling

Tailwind CSS powers the global design system. Dark mode is class-based (`dark`) and controlled via the ThemeToggle component, which persists the user's preference. Extend theme tokens in `tailwind.config.cjs` as needed.

## Collaboration Checklist

- Coordinate backend authentication responses (`token`, `user` payloads) with `src/context/AuthContext.tsx`.
- Update API endpoints or payload shapes in a single place to keep fetch calls consistent.
- Remove demo/test stubs before production deployment.
