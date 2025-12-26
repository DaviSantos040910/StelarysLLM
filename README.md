# Stelarys Mobile App

Mobile frontend for StelarysLM, a "Second Brain" application for document management and study, built with React Native (Expo).

## Architecture

- **Framework:** React Native + Expo (SDK 52+)
- **Routing:** Expo Router (`/app`)
- **Styling:** NativeWind v4 (TailwindCSS)
- **State Management:** Zustand
- **Networking:** Axios (REST) + Fetch (Streaming)
- **Storage:** Expo Secure Store (Tokens), Async Storage (Preferences)

## Project Structure

```
/app
  /_layout.tsx      # Root layout (Auth Guard, Providers)
  /(auth)           # Login/Signup screens
  /(tabs)           # Main tabs (Library, Profile)
  /study
    /[id].tsx       # Chat Interface (Streaming, Attachments)
    /details.tsx    # Study Settings & File Management
  /create           # Create New Study Modal
/src
  /api              # Axios client configuration
  /services         # API service layers (auth, workspace, chat)
  /stores           # Zustand global stores
  /components       # Reusable UI components
  /types            # TypeScript interfaces
```

## Setup & Running

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Environment:**
    - The app connects to the backend URL defined in `src/api/client.ts`.
    - Default Dev URL: `http://127.0.0.1:8000` (adjust if running on physical device).

3.  **Run:**
    ```bash
    npx expo start
    ```

## Key Features

- **Authentication:** Login/Signup with JWT storage.
- **Library:** View subscribed study workspaces.
- **Create Study:** Create new workspace with Category and initial Knowledge Base (File Upload).
- **Study Chat:**
  - Real-time streaming AI responses.
  - Markdown rendering.
  - File attachments (PDF/DOCX/TXT) for RAG.
- **File Management:** View and delete files associated with a study.

## Backend Integration Notes

- **Authentication:** Uses `/auth/login/` and `/auth/register/`.
- **Workspaces (Bots):** Uses `/api/v1/bots/` for creation and subscription.
- **Chat:** Uses `/api/v1/chats/` for message history and `/api/v1/chats/{id}/stream/` for SSE streaming.
- **RAG:** Uploads files to `/api/v1/chats/{id}/messages/attach/` which triggers backend vector processing.
