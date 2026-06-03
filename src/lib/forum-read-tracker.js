const STORAGE_KEY = 'rlt_forum_read';

export function getReadTimestamps() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

export function markThreadRead(threadId) {
  const timestamps = getReadTimestamps();
  timestamps[threadId] = Date.now();
  const entries = Object.entries(timestamps).sort((a, b) => b[1] - a[1]).slice(0, 200);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
}

export function getUnreadReplyCount(threadId, replies, lastReadTimestamp) {
  if (!lastReadTimestamp) return replies.length;
  return replies.filter(r => new Date(r.created_date).getTime() > lastReadTimestamp).length;
}

export function hasUnreadReplies(threadId, replies) {
  const timestamps = getReadTimestamps();
  const lastRead = timestamps[threadId];
  if (!lastRead) return replies.length > 0;
  return replies.some(r => new Date(r.created_date).getTime() > lastRead);
}
