import test from "node:test";
import assert from "node:assert/strict";

import {
  buildForumThreads,
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

test("builds forum replies with a parent post id", () => {
  const reply = buildPendingForumPost({
    author_name: "  Sam  ",
    body: " Count me in. ",
    category: "Events",
    parent_id: " parent-123 ",
  });

  assert.deepEqual(reply, {
    author_name: "Sam",
    title: "Reply",
    body: "Count me in.",
    category: "Events",
    parent_id: "parent-123",
    is_published: false,
    is_pinned: false,
  });
});

test("groups published forum replies under their parent thread", () => {
  const threads = buildForumThreads([
    { id: "reply-hidden", parent_id: "post-1", body: "Hidden", is_published: false },
    { id: "reply-2", parent_id: "post-1", body: "Second", is_published: true, created_date: "2026-02-02T00:00:00.000Z" },
    { id: "post-1", title: "Vegas", body: "Hello", is_published: true, created_date: "2026-02-01T00:00:00.000Z" },
    { id: "reply-1", parent_id: "post-1", body: "First", is_published: true, created_date: "2026-02-01T12:00:00.000Z" },
  ]);

  assert.equal(threads.length, 1);
  assert.equal(threads[0].id, "post-1");
  assert.deepEqual(threads[0].replies.map((reply) => reply.id), ["reply-1", "reply-2"]);
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
      trip_details: "  10 days, 5-star hotel, custom stadium tour  ",
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
    trip_details: "10 days, 5-star hotel, custom stadium tour",
    consent_to_contact: true,
    consent_timestamp: "2026-05-31T03:15:00.000Z",
    source: "homepage_travel_form",
  });
});

test("registration trip_details defaults to empty string when omitted", () => {
  const registration = normalizeInterestRegistration({
    name: "Sam",
    email: "sam@example.com",
    team_supported: "Storm",
    consent_to_contact: true,
  });
  assert.equal(registration.trip_details, "");
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
