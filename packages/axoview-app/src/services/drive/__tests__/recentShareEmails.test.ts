import { getRecentShareEmails, addRecentShareEmail } from '../recentShareEmails';

beforeEach(() => {
  localStorage.clear();
});

test('returns [] when nothing has been stored', () => {
  expect(getRecentShareEmails()).toEqual([]);
});

test('adds an email to the front (most-recent-first)', () => {
  addRecentShareEmail('a@x.com');
  addRecentShareEmail('b@x.com');
  expect(getRecentShareEmails()).toEqual(['b@x.com', 'a@x.com']);
});

test('de-duplicates case-insensitively, moving the repeat to the front', () => {
  addRecentShareEmail('a@x.com');
  addRecentShareEmail('b@x.com');
  addRecentShareEmail('A@X.com');
  expect(getRecentShareEmails()).toEqual(['A@X.com', 'b@x.com']);
});

test('trims and ignores blank input', () => {
  addRecentShareEmail('   ');
  addRecentShareEmail('  c@x.com  ');
  expect(getRecentShareEmails()).toEqual(['c@x.com']);
});

test('caps the list at 20 entries', () => {
  for (let i = 0; i < 25; i += 1) addRecentShareEmail(`u${i}@x.com`);
  const list = getRecentShareEmails();
  expect(list).toHaveLength(20);
  expect(list[0]).toBe('u24@x.com'); // newest kept
  expect(list).not.toContain('u4@x.com'); // oldest dropped
});

test('tolerates corrupt storage', () => {
  localStorage.setItem('axoview.recentShareEmails', '{not json');
  expect(getRecentShareEmails()).toEqual([]);
});
