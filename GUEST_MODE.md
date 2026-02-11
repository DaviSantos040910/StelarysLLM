# Guest Mode Implementation

This document outlines the architecture and implementation details of the "Guest Mode" feature, allowing users to experience the app for a 3-day trial period without creating an account.

## Architecture Overview

The system supports dual ownership for all user-generated content (Bots, Chats, Study Spaces, Knowledge Sources, etc.). Content can belong to either a registered `User` or a temporary `GuestSession`.

### 1. Authentication & Session Management

-   **Frontend**:
    -   Generates a UUIDv4 `guest_id` on first launch via `expo-crypto`.
    -   Persists it in `SecureStore`.
    -   Injects `X-Guest-Id` header into API requests if no JWT `Authorization` header is present.
-   **Backend**:
    -   `GuestAuthentication` middleware checks for `X-Guest-Id`.
    -   Creates or retrieves a `GuestSession` model.
    -   `IsUserOrGuest` permission class grants access if the user is authenticated OR if the guest session is active and within the 3-day trial.

### 2. Database Models

New model: `accounts.GuestSession`
-   `id`: UUID
-   `created_at`: DateTime
-   `trial_expires_at`: DateTime (default: created_at + 3 days)
-   `claimed_by`: User (FK, nullable)
-   `is_active`: Boolean

Updates to existing models (`Bot`, `Chat`, `StudySpace`, `KnowledgeSource`, `SearchHistory`, `KnowledgeArtifact`):
-   Added `guest_session` (ForeignKey to `GuestSession`, nullable).
-   Made `user` / `owner` (ForeignKey to `User`) nullable.
-   **Rule**: An object must belong to *either* a User *or* a GuestSession (enforced via application logic and querysets).

### 3. API Endpoints

#### `POST /api/v1/accounts/claim_guest/`
**Purpose**: Migrates all data from the current Guest Session to the authenticated User account.
**Headers**:
-   `Authorization`: `Bearer <token>`
-   `X-Guest-Id`: `<uuid>`
**Logic**:
1.  Verifies Guest Session exists and is unclaimed.
2.  Performs atomic transaction to update all FKs (`owner`/`user` -> `request.user`, `guest_session` -> `NULL`).
3.  Migrates Vector Database (ChromaDB) embeddings from `guest_uuid` to `user_id`.
4.  Marks `GuestSession` as inactive and claimed.

### 4. Data Isolation

-   **Views/ViewSets**: Use a helper `get_actor(request)` to determine context.
-   **QuerySets**: Filter by `owner=user` OR `guest_session=session` to ensure guests only see their own data and logged-in users do not see guest data.

### 5. Frontend Flow

1.  **Onboarding**:
    -   Checks `hasSeenOnboarding` (AsyncStorage).
    -   If false, redirects to `/onboarding`.
    -   If true, allows access to main app (`(tabs)`) even without a token (Guest Mode).
2.  **Claiming**:
    -   Upon successful Login or Signup, the frontend automatically calls the `claim_guest` endpoint using the locally stored `guest_id`.
3.  **Trial Expiry**:
    -   Backend raises `403 Forbidden` with code `TRIAL_EXPIRED`.
    -   Frontend `Axios` interceptor catches this and redirects to `/paywall`.

## Testing

-   **Backend Tests**: `backend/accounts/tests_guest.py`, `backend/accounts/tests_guest_data.py`, `backend/accounts/tests_claim.py`.
-   **Flow**: Validated via E2E simulation in `backend/accounts/tests_flow.py`.
