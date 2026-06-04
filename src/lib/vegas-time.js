export const LAS_VEGAS_TIME_ZONE = "America/Los_Angeles";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const parsedDate = (value) => {
  if (!value) return null;
  const source = String(value);
  const date = new Date(DATE_ONLY.test(source) ? `${source}T12:00:00Z` : source);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatVegasDate = (value) => {
  const date = parsedDate(value);
  if (!date) return value || "";
  return date.toLocaleDateString("en-AU", {
    timeZone: LAS_VEGAS_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const formatVegasTime = (value) => {
  const date = parsedDate(value);
  if (!date) return value || "";
  return date.toLocaleTimeString("en-AU", {
    timeZone: LAS_VEGAS_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
};

export const formatVegasDateTime = (value) => {
  const date = parsedDate(value);
  if (!date) return value || "";
  return date.toLocaleString("en-AU", {
    timeZone: LAS_VEGAS_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
};

export const hasTimeValue = (value) => /T\d{2}:\d{2}/.test(String(value || ""));

export const formatVegasEventTime = (event) => {
  if (!event) return "";
  if (hasTimeValue(event.event_date)) return formatVegasTime(event.event_date);
  return event.start_time ? `${event.start_time} Las Vegas time` : "";
};