import { parseForumDate } from "./forum-dates.js";

const STORAGE_KEY = 'rlt_forum_read';

export function getReadTimestamps() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

export function markThreadRead(threadId) {
  const timestamps = getReadTimestamps();
  timestamps[threadId] = Date.now();
  const entries = Object.entries(timestamps).sort((a, b) => b[1] - a[1]).slice(0, 200);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries))); } catch { /* private mode */ }
}

// Timestamps MUST go through parseForumDate: the backend returns tz-less UTC,
// which `new Date()` reads as LOCAL time — 10 hours in the future for AEST —
// so every reply from the last ~10 hours compared as older than lastRead and
// the unread pill never fired for the entire Australian audience.
const replyTime = (reply) => parseForumDate(reply?.created_date)?.getTime() || 0;

// Replies are a tree (replies of replies); a flat scan missed every nested
// reply, so an answer to your comment never showed as new.
function flattenReplies(replies, out = []) {
  for (const reply of replies || []) {
    out.push(reply);
    if (reply?.replies?.length) flattenReplies(reply.replies, out);
  }
  return out;
}

export function getUnreadReplyCount(threadId, replies, lastReadTimestamp) {
  const all = flattenReplies(replies);
  if (!lastReadTimestamp) return all.length;
  return all.filter((r) => replyTime(r) > lastReadTimestamp).length;
}

export function hasUnreadReplies(threadId, replies) {
  const timestamps = getReadTimestamps();
  const lastRead = timestamps[threadId];
  const all = flattenReplies(replies);
  if (!lastRead) return all.length > 0;
  return all.some((r) => replyTime(r) > lastRead);
}
