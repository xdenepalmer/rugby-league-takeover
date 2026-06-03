export const FORUM_CATEGORIES = ["General", "Travel", "Events", "MatchDay", "VegasTips"];
export const SUPPORTED_TEAMS = ["Eels", "Tigers", "Titans", "Storm", "Leopards", "Bulls", "Other"];

const trimToLength = (value, maxLength) => String(value ?? "").trim().slice(0, maxLength);

const assertPresent = (value, label) => {
  if (!trimToLength(value, 1)) {
    throw new Error(`${label} is required`);
  }
};

const assertEmail = (email) => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid email address is required");
  }
};

export function isLikelyBotSubmission(form) {
  return Boolean(trimToLength(form?.website, 256) || trimToLength(form?.company, 256));
}

export function buildPendingForumPost(input) {
  const category = trimToLength(input?.category || "General", 32);
  if (!FORUM_CATEGORIES.includes(category)) {
    throw new Error("Forum category is not supported");
  }

  const parentId = trimToLength(input?.parent_id, 120);
  assertPresent(input?.author_name, "Name");
  assertPresent(input?.body, "Message");

  const post = {
    author_name: trimToLength(input.author_name, 80),
    title: trimToLength(input.title || (parentId ? "Reply" : "Discussion Thread"), 120),
    body: trimToLength(input.body, 2000),
    category,
    is_published: false,
    is_pinned: false,
  };

  if (parentId) {
    post.parent_id = parentId;
  }

  return post;
}

const forumDateValue = (post) => {
  const value = new Date(post?.created_date || 0).getTime();
  return Number.isFinite(value) ? value : 0;
};

// Total number of nested replies under a node (all descendants).
export function countReplies(node) {
  return (node?.replies || []).reduce((total, child) => total + 1 + countReplies(child), 0);
}

// Builds a nested tree: top-level threads, each with `replies`, and each reply
// can itself have `replies` (true threading at any depth). De-duplicates by id
// and drops orphans whose parent isn't visible.
export function buildForumThreads(posts = []) {
  const seen = new Set();
  const byId = new Map();
  const published = [];

  for (const post of posts || []) {
    if (!post || post.is_published === false) continue;
    if (post.id) {
      if (seen.has(post.id)) continue;
      seen.add(post.id);
    }
    published.push(post);
    if (post.id) byId.set(post.id, post);
  }

  const childrenOf = new Map();
  const roots = [];

  for (const post of published) {
    if (post.parent_id) {
      if (!byId.has(post.parent_id)) continue; // orphaned reply (missing/unpublished parent)
      if (!childrenOf.has(post.parent_id)) childrenOf.set(post.parent_id, []);
      childrenOf.get(post.parent_id).push(post);
    } else {
      roots.push(post);
    }
  }

  const attach = (node, visited) => {
    if (visited.has(node.id)) return { ...node, replies: [] };
    visited.add(node.id);
    const children = [...(childrenOf.get(node.id) || [])]
      .sort((a, b) => forumDateValue(a) - forumDateValue(b))
      .map((child) => attach(child, visited));
    return { ...node, replies: children };
  };

  return [...roots]
    .sort((a, b) => Number(b.is_pinned === true) - Number(a.is_pinned === true) || forumDateValue(b) - forumDateValue(a))
    .map((thread) => attach(thread, new Set()));
}

export function normalizeInterestRegistration(input, timestamp = new Date().toISOString()) {
  const email = trimToLength(input?.email, 200).toLowerCase();

  assertPresent(input?.name, "Name");
  assertPresent(email, "Email");
  assertEmail(email);

  const team = trimToLength(input?.team_supported, 40);
  if (!SUPPORTED_TEAMS.includes(team)) {
    throw new Error("Team supported is required");
  }

  if (input?.consent_to_contact !== true) {
    throw new Error("Contact consent is required");
  }

  return {
    name: trimToLength(input.name, 120),
    phone: trimToLength(input.phone, 40),
    email,
    postcode: trimToLength(input.postcode, 20),
    team_supported: team,
    trip_details: trimToLength(input.trip_details, 1000),
    consent_to_contact: true,
    consent_timestamp: timestamp,
    source: "homepage_travel_form",
  };
}
