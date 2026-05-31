import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPendingForumPost,
  isLikelyBotSubmission,
  normalizeInterestRegistration,
} from "../src/lib/public-forms.js";

test("builds forum posts as unpublished moderation submissions", () => {
  const post = buildPendingForumPost({
    author_name: "  Jess  ",
    title: " Flights? ",
    body: " Any group fares from Brisbane? ",
    category: "Travel",
  });

  assert.deepEqual(post, {
    author_name: "Jess",
    title: "Flights?",
    body: "Any group fares from Brisbane?",
    category: "Travel",
    is_published: false,
    is_pinned: false,
  });
});

test("rejects invalid forum categories", () => {
  assert.throws(
    () => buildPendingForumPost({ author_name: "Jess", body: "Hello", category: "Spam" }),
    /category/i
  );
});

test("normalizes registrations with consent metadata", () => {
  const registration = normalizeInterestRegistration(
    {
      name: "  Sam Fan ",
      phone: " 0400 111 222 ",
      email: " SAM@EXAMPLE.COM ",
      postcode: " 4000 ",
      team_supported: "Storm",
      consent_to_contact: true,
    },
    "2026-05-31T03:15:00.000Z"
  );

  assert.deepEqual(registration, {
    name: "Sam Fan",
    phone: "0400 111 222",
    email: "sam@example.com",
    postcode: "4000",
    team_supported: "Storm",
    consent_to_contact: true,
    consent_timestamp: "2026-05-31T03:15:00.000Z",
    source: "homepage_travel_form",
  });
});

test("requires contact consent for registrations", () => {
  assert.throws(
    () => normalizeInterestRegistration({ name: "Sam", email: "sam@example.com", team_supported: "Storm" }),
    /consent/i
  );
});

test("detects honeypot bot submissions", () => {
  assert.equal(isLikelyBotSubmission({ website: "https://spam.example" }), true);
  assert.equal(isLikelyBotSubmission({ website: "" }), false);
  assert.equal(isLikelyBotSubmission({}), false);
});
