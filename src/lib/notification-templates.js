/**
 * Notification Templates
 *
 * Pure functions that return Notification entity shapes.
 * The caller is responsible for persisting via:
 *   base44.entities.Notification.create(template)
 *
 * Type enum values: 'reply' | 'mention' | 'system'
 */

/**
 * Order has been shipped.
 * @param {{ id: string, user_id: string, user_email: string, tracking_number?: string }} order
 */
export function orderShipped(order) {
  return {
    recipient_id: order.user_id,
    recipient_email: order.user_email,
    type: "system",
    title: "Your order has shipped! 📦",
    preview: order.tracking_number
      ? `Tracking: ${order.tracking_number}`
      : "Your order is on its way.",
    link: `/orders/${order.id}`,
    actor_name: "Rugby League Takeover",
  };
}

/**
 * Order has been delivered.
 * @param {{ id: string, user_id: string, user_email: string }} order
 */
export function orderDelivered(order) {
  return {
    recipient_id: order.user_id,
    recipient_email: order.user_email,
    type: "system",
    title: "Your order has been delivered! ✅",
    preview: "Your order has arrived — enjoy your gear!",
    link: `/orders/${order.id}`,
    actor_name: "Rugby League Takeover",
  };
}

/**
 * Someone replied to a forum post.
 * @param {{ id: string, user_id: string, user_email: string, title?: string }} post - Original post
 * @param {{ id: string, body?: string }} reply - The reply post
 * @param {string} replierName - Display name of the person replying
 */
export function forumReply(post, reply, replierName) {
  return {
    recipient_id: post.user_id,
    recipient_email: post.user_email,
    type: "reply",
    title: `${replierName} replied to your post`,
    preview: reply.body ? reply.body.slice(0, 120) : "New reply on your post",
    link: "/forum",
    actor_name: replierName,
    post_id: post.id,
  };
}

/**
 * Someone mentioned a user in a forum post.
 * @param {{ id: string, user_id: string, user_email: string, title?: string }} post - Post containing the mention
 * @param {string} mentionerName - Display name of the person who mentioned
 */
export function forumMention(post, mentionerName) {
  return {
    recipient_id: post.user_id,
    recipient_email: post.user_email,
    type: "mention",
    title: `${mentionerName} mentioned you`,
    preview: post.title
      ? `In "${post.title}"`
      : "You were mentioned in a post",
    link: "/forum",
    actor_name: mentionerName,
    post_id: post.id,
  };
}

/**
 * User earned a badge.
 * @param {string} userId
 * @param {string} userEmail
 * @param {string} badgeName
 */
export function badgeEarned(userId, userEmail, badgeName) {
  return {
    recipient_id: userId,
    recipient_email: userEmail,
    type: "system",
    title: `Badge Earned: ${badgeName} 🏅`,
    preview: `You earned the "${badgeName}" badge — nice work!`,
    link: "/profile",
    actor_name: "Rugby League Takeover",
  };
}

/**
 * Travel registration update.
 * @param {{ user_id: string, user_email: string }} registration
 * @param {string} message - Update message text
 */
export function travelUpdate(registration, message) {
  return {
    recipient_id: registration.user_id,
    recipient_email: registration.user_email,
    type: "system",
    title: "Travel Update ✈️",
    preview: message.slice(0, 120),
    link: "/travel",
    actor_name: "Rugby League Takeover",
  };
}

/**
 * New product drop notification.
 * @param {string} userId
 * @param {string} userEmail
 * @param {{ name: string, id?: string }} product
 */
export function productDrop(userId, userEmail, product) {
  return {
    recipient_id: userId,
    recipient_email: userEmail,
    type: "system",
    title: `New Drop: ${product.name} 🔥`,
    preview: `${product.name} just dropped — grab it before it's gone!`,
    link: product.id ? `/merch/${product.id}` : "/merch",
    actor_name: "Rugby League Takeover",
  };
}
