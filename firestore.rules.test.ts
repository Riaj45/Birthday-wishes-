/**
 * Phase 0 Security Test Specification for Birthday Magic Firestore Rules.
 * Verifies all "Dirty Dozen" adversarial payloads are rejected (PERMISSION_DENIED).
 */

export interface AdversarialTestCase {
  id: string;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email?: string; email_verified?: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: AdversarialTestCase[] = [
  {
    id: 'DD-01',
    name: 'Shadow Field Injection on Project Create',
    collectionPath: 'projects/valid_proj_01',
    operation: 'create',
    auth: null,
    payload: {
      id: 'valid_proj_01',
      recipientName: 'Maya',
      senderName: 'Alex',
      headline: 'Happy Birthday',
      message: 'Wishing you joy',
      templateId: 'golden-candlelight',
      animationPresetId: 'confetti-gold',
      status: 'draft',
      visitCount: 0,
      isAdmin: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-02',
    name: 'Unauthenticated Read of Draft Project',
    collectionPath: 'projects/draft_proj_01',
    operation: 'get',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-03',
    name: 'Unauthenticated Listing of Projects Collection',
    collectionPath: 'projects',
    operation: 'list',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-04',
    name: 'Unverified Admin Email Spoof on Templates',
    collectionPath: 'templates/tpl_spoof',
    operation: 'create',
    auth: { uid: 'spoof-uid', email: 'skalihossen9547@gmail.com', email_verified: false },
    payload: { id: 'tpl_spoof', name: 'Spoof', category: 'Classic', themeMode: 'light', accentColor: '#000', active: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-05',
    name: 'Self-Assigned Admin Escalation',
    collectionPath: 'admins/attacker_uid',
    operation: 'create',
    auth: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    payload: { email: 'attacker@example.com', role: 'admin' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-06',
    name: 'Document ID Poisoning',
    collectionPath: 'projects/bad id with spaces and $$$',
    operation: 'create',
    auth: null,
    payload: { id: 'bad id with spaces and $$$' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-07',
    name: 'Value Poisoning on Public Visit Counter',
    collectionPath: 'projects/pub_proj_01',
    operation: 'update',
    auth: null,
    payload: { visitCount: 999999, message: 'Hacked message' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-08',
    name: 'Client-Forged Backdated Timestamp',
    collectionPath: 'projects/time_proj_01',
    operation: 'create',
    auth: null,
    payload: { id: 'time_proj_01', createdAt: '1999-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-09',
    name: 'Array Bombing Beyond Bounded Limits',
    collectionPath: 'projects/bomb_proj_01',
    operation: 'create',
    auth: null,
    payload: { id: 'bomb_proj_01', photos: new Array(30).fill({ url: '/uploads/x.jpg' }) },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-10',
    name: 'Orphan Report with Pre-Resolved Status',
    collectionPath: 'reports/rep_orphan',
    operation: 'create',
    auth: null,
    payload: { id: 'rep_orphan', projectId: 'does_not_exist', reason: 'spam', status: 'resolved' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-11',
    name: 'Public Read Attempt on Moderation Reports',
    collectionPath: 'reports',
    operation: 'list',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-12',
    name: 'Non-Admin Mutation of Global Site Settings',
    collectionPath: 'settings/global',
    operation: 'update',
    auth: { uid: 'regular_user', email: 'user@example.com', email_verified: true },
    payload: { maxImageSizeMb: 9999 },
    expected: 'PERMISSION_DENIED',
  },
];
