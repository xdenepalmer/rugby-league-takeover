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

  assertPresent(input?.author_name, "Name");
  assertPresent(input?.body, "Message");

  return {
    author_name: trimToLength(input.author_name, 80),
    title: trimToLength(input.title || "Discussion Thread", 120),
    body: trimToLength(input.body, 2000),
    category,
    is_published: false,
    is_pinned: false,
  };
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
    consent_to_contact: true,
    consent_timestamp: timestamp,
    source: "homepage_travel_form",
  };
}
