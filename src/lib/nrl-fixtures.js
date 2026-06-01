export const NRL_CLUBS = [
  "Brisbane Broncos",
  "Canberra Raiders",
  "Canterbury-Bankstown Bulldogs",
  "Cronulla-Sutherland Sharks",
  "Dolphins",
  "Gold Coast Titans",
  "Manly Warringah Sea Eagles",
  "Melbourne Storm",
  "Newcastle Knights",
  "New Zealand Warriors",
  "North Queensland Cowboys",
  "Parramatta Eels",
  "Penrith Panthers",
  "South Sydney Rabbitohs",
  "St. George Illawarra Dragons",
  "Sydney Roosters",
  "Wests Tigers"
];

const VENUES = [
  "Suncorp Stadium",
  "Accor Stadium",
  "AAMI Park",
  "CommBank Stadium",
  "McDonald Jones Stadium",
  "PointsBet Stadium",
  "4 Pines Park",
  "Queensland Country Bank Stadium",
  "Go Media Stadium",
  "Cbus Super Stadium"
];

const GAME_SLOTS = [
  { dayOffset: 0, hour: 19, minute: 50 },
  { dayOffset: 1, hour: 18, minute: 0 },
  { dayOffset: 1, hour: 20, minute: 5 },
  { dayOffset: 2, hour: 15, minute: 0 },
  { dayOffset: 2, hour: 17, minute: 30 },
  { dayOffset: 2, hour: 19, minute: 35 },
  { dayOffset: 3, hour: 14, minute: 0 },
  { dayOffset: 3, hour: 16, minute: 5 }
];

const nextThursday = (fromDate) => {
  const d = new Date(fromDate);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (4 - day + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
};

const rotate = (arr, by) => [...arr.slice(by % arr.length), ...arr.slice(0, by % arr.length)];

export function buildRollingNrlFixtures(fromDate = new Date(), weekCount = 5) {
  const firstRoundStart = nextThursday(fromDate);
  const seasonSeed = firstRoundStart.getFullYear() % NRL_CLUBS.length;
  const fixtures = [];

  for (let week = 0; week < weekCount; week += 1) {
    const roundStart = new Date(firstRoundStart);
    roundStart.setDate(roundStart.getDate() + week * 7);
    const teams = rotate(NRL_CLUBS, seasonSeed + week * 3);

    GAME_SLOTS.forEach((slot, i) => {
      const home = teams[i * 2];
      const away = teams[i * 2 + 1] || teams[(i * 2 + 5) % teams.length];
      const kickoff = new Date(roundStart);
      kickoff.setDate(roundStart.getDate() + slot.dayOffset);
      kickoff.setHours(slot.hour, slot.minute, 0, 0);

      fixtures.push({
        id: `nrl-${kickoff.toISOString().slice(0, 10)}-${home.replace(/[^a-z0-9]/gi, "").toLowerCase()}-${away.replace(/[^a-z0-9]/gi, "").toLowerCase()}`,
        home_team: home,
        away_team: away,
        kickoff: kickoff.toISOString(),
        label: `NRL Round ${week + 1}`,
        venue: VENUES[(week + i) % VENUES.length],
        is_published: true,
        generated: true,
      });
    });
  }

  return fixtures;
}

export function formatKickoff(value) {
  if (!value) return "TBA";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "TBA";
  return d.toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function isNearFixture(value) {
  if (!value) return true;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return true;
  const now = Date.now();
  return time > now - 4 * 60 * 60 * 1000 && time < now + 45 * 24 * 60 * 60 * 1000;
}