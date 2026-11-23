# Birthday Magic — Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **No Public Scraping of Private/Draft Projects**: Unauthenticated visitors may only `get` a single `/projects/{projectId}` when `resource.data.status == 'published'`. Listing `/projects` is strictly restricted to verified administrators (`isAdmin()`).
2. **Edit Token Isolation**: Private edit tokens are never persisted in public Firestore project documents or exposed in public URLs. Server-side token hashing (`SHA-256`) and constant-time verification guard all owner edit/revoke/delete APIs.
3. **Admin Privilege Separation**: Only verified administrators (present in `/admins/{uid}` or matching the verified bootstrapped admin email with `email_verified == true`) may mutate `/templates`, `/animationPresets`, `/musicTracks`, `/backgrounds`, `/settings`, `/admins`, or moderate `/projects` and `/reports`.
4. **No Self-Assigned Admin Escalation**: Unauthenticated or non-admin users cannot create or modify `/admins/{uid}` documents.
5. **Referential Integrity on Reports**: A content report in `/reports/{reportId}` may only be created if the referenced `/projects/{projectId}` exists, and initial status must be `'open'`.
6. **Strict Schema & Volumetric Bounds**: Every string field enforces `.size()` limits, every list field enforces `.size() <= MAX` bounds, and every document ID matches `^[a-zA-Z0-9_\-]+$`.
7. **Temporal & Immutability Integrity**: `createdAt` and `id` are immutable after creation; `createdAt`/`updatedAt` are validated against `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on Project Create**: Injecting `isAdmin: true` or `featuredOverride: true` into `/projects/{id}`. Expected: `PERMISSION_DENIED`.
2. **Draft Project Leakage (`get` on draft)**: Unauthenticated `get` on `/projects/{id}` where `status == 'draft'` or `'unpublished'`. Expected: `PERMISSION_DENIED`.
3. **Collection Scraping (`list` on projects)**: Unauthenticated `list` on `/projects`. Expected: `PERMISSION_DENIED`.
4. **Unverified Admin Email Spoof**: Authenticated token with admin email string but `email_verified: false` attempting write to `/templates/{id}`. Expected: `PERMISSION_DENIED`.
5. **Privilege Escalation (`/admins/{uid}`)**: Non-admin authenticated user attempting to write `{ role: 'admin', email: 'attacker@example.com' }` into `/admins/{uid}`. Expected: `PERMISSION_DENIED`.
6. **ID Poisoning**: Creating `/projects/` with a 200-char or slash/space-containing document ID. Expected: `PERMISSION_DENIED`.
7. **Value Poisoning on Visit Increment**: Updating a published project's `visitCount` to `999999` or mutating `message` during a public visit update. Expected: `PERMISSION_DENIED`.
8. **Backdated Timestamp Tampering**: Creating a project with client-forged `createdAt` not equal to `request.time`. Expected: `PERMISSION_DENIED`.
9. **Array Bombing**: Creating a project with `photos` containing 50 items (> 12 limit) or `wishes` containing 100 items (> 20 limit). Expected: `PERMISSION_DENIED`.
10. **Orphan Report Creation**: Creating `/reports/{id}` referencing a non-existent `projectId` or setting initial `status: 'resolved'`. Expected: `PERMISSION_DENIED`.
11. **Report PII/Abuse Reading**: Public or non-admin user attempting `get` or `list` on `/reports`. Expected: `PERMISSION_DENIED`.
12. **Site Settings Hijack**: Non-admin attempting to update `/settings/global` to disable limits or alter branding. Expected: `PERMISSION_DENIED`.
