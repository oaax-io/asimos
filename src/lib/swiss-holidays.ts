/**
 * Schweizer Feiertage – national + kantonal, inkl. Unterscheidung
 * bezahlt (den Sonntagen gleichgestellt) / unbezahlt (nicht gesetzlich).
 */

export type HolidayScope = "national" | "cantonal";

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  paid: boolean;
  scope: HolidayScope;
  cantons: string[]; // Kantone in denen der Tag gilt (leer = alle)
}

export const CANTONS: { code: string; name: string }[] = [
  { code: "AG", name: "Aargau" },
  { code: "AI", name: "Appenzell Innerrhoden" },
  { code: "AR", name: "Appenzell Ausserrhoden" },
  { code: "BE", name: "Bern" },
  { code: "BL", name: "Basel-Landschaft" },
  { code: "BS", name: "Basel-Stadt" },
  { code: "FR", name: "Freiburg" },
  { code: "GE", name: "Genf" },
  { code: "GL", name: "Glarus" },
  { code: "GR", name: "Graubünden" },
  { code: "JU", name: "Jura" },
  { code: "LU", name: "Luzern" },
  { code: "NE", name: "Neuenburg" },
  { code: "NW", name: "Nidwalden" },
  { code: "OW", name: "Obwalden" },
  { code: "SG", name: "St. Gallen" },
  { code: "SH", name: "Schaffhausen" },
  { code: "SO", name: "Solothurn" },
  { code: "SZ", name: "Schwyz" },
  { code: "TG", name: "Thurgau" },
  { code: "TI", name: "Tessin" },
  { code: "UR", name: "Uri" },
  { code: "VD", name: "Waadt" },
  { code: "VS", name: "Wallis" },
  { code: "ZG", name: "Zug" },
  { code: "ZH", name: "Zürich" },
];

const ALL = CANTONS.map((c) => c.code);
const CATHOLIC = ["AG", "AI", "FR", "GR", "JU", "LU", "NW", "OW", "SO", "SZ", "TI", "UR", "VS", "ZG"];

function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shift(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/** Gauss/Meeus – Ostersonntag (gregorianisch) */
function easter(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** n-ter Wochentag (0=So) eines Monats */
function nthWeekday(year: number, month: number, weekday: number, n: number) {
  const d = new Date(year, month, 1);
  let count = 0;
  while (true) {
    if (d.getDay() === weekday) {
      count++;
      if (count === n) return new Date(d);
    }
    d.setDate(d.getDate() + 1);
  }
}

export function swissHolidays(year: number): Holiday[] {
  const e = easter(year);
  const h: Holiday[] = [];
  const add = (date: Date | string, name: string, paid: boolean, cantons: string[], scope: HolidayScope = "cantonal") =>
    h.push({ date: typeof date === "string" ? `${year}-${date}` : iso(date), name, paid, scope, cantons });

  // Nationale / in allen Kantonen bezahlte Feiertage
  add("01-01", "Neujahr", true, ALL, "national");
  add(shift(e, 39), "Auffahrt", true, ALL, "national");
  add("08-01", "Bundesfeier (1. August)", true, ALL, "national");
  add("12-25", "Weihnachten", true, ALL, "national");

  // Ostern
  add(shift(e, -2), "Karfreitag", true, ALL.filter((c) => !["VS", "TI"].includes(c)));
  add(e, "Ostersonntag", true, ALL);
  add(shift(e, 1), "Ostermontag", true, ALL.filter((c) => c !== "VS"));
  add(shift(e, 49), "Pfingsten", true, ALL);
  add(shift(e, 50), "Pfingstmontag", true, ALL.filter((c) => c !== "VS"));

  // Stephanstag
  add("12-26", "Stephanstag", true, ALL.filter((c) => !["VS", "GE", "JU"].includes(c)));

  // Berchtoldstag
  add("01-02", "Berchtoldstag", true, ["BE", "JU", "VD", "NE", "TG", "GL", "SH"]);
  add("01-02", "Berchtoldstag (nicht gesetzlich)", false, ["ZH", "AG", "SO", "LU", "ZG", "BL", "BS", "FR", "OW", "NW", "SG", "GR", "AR", "AI", "UR", "SZ"]);

  // Tag der Arbeit
  add("05-01", "Tag der Arbeit", true, ["ZH", "BS", "BL", "SH", "TI", "JU", "NE", "TG", "AG", "SO", "FR"]);
  add("05-01", "Tag der Arbeit (nicht gesetzlich)", false, ALL.filter((c) => !["ZH", "BS", "BL", "SH", "TI", "JU", "NE", "TG", "AG", "SO", "FR"].includes(c)));

  // Katholische Feiertage
  add(shift(e, 60), "Fronleichnam", true, CATHOLIC);
  add("08-15", "Mariä Himmelfahrt", true, CATHOLIC);
  add("11-01", "Allerheiligen", true, [...CATHOLIC, "SG", "GL"]);
  add("12-08", "Mariä Empfängnis", true, CATHOLIC.filter((c) => c !== "JU" && c !== "SO"));
  add("03-19", "St. Josef", true, ["UR", "SZ", "NW", "TI", "VS", "GR", "LU"]);
  add("01-06", "Heilige Drei Könige", true, ["UR", "SZ", "TI", "GR", "LU"]);
  add("06-29", "Peter und Paul", true, ["TI", "GR"]);

  // Kantonale Besonderheiten
  add(nthWeekday(year, 3, 4, 1), "Näfelser Fahrt", true, ["GL"]); // 1. Donnerstag im April
  add(shift(nthWeekday(year, 8, 0, 1), 4), "Jeûne genevois", true, ["GE"]); // Do nach 1. So im September
  add("12-31", "Restauration de la République", true, ["GE"]);
  add("03-01", "Fête de l'Instauration", true, ["NE"]);
  add("06-23", "Fest der Unabhängigkeit", true, ["JU"]);
  add(shift(nthWeekday(year, 8, 0, 3), 1), "Bettagsmontag (Lundi du Jeûne)", true, ["VD"]);
  add(shift(nthWeekday(year, 8, 0, 3), 0), "Eidg. Dank-, Buss- und Bettag", true, ALL.filter((c) => c !== "GE"));

  // Nicht bezahlte / halbe Tage
  add(shift(nthWeekday(year, 8, 0, 2), 1), "Knabenschiessen (halber Tag)", false, ["ZH"]);
  add(nthWeekday(year, 3, 1, 3), "Sechseläuten (halber Tag)", false, ["ZH"]);
  add("12-24", "Heiligabend (nicht gesetzlich)", false, ALL);
  add("12-31", "Silvester (nicht gesetzlich)", false, ALL.filter((c) => c !== "GE"));

  return h.sort((a, b) => a.date.localeCompare(b.date));
}

export function holidaysForCanton(year: number, canton: string, includeUnpaid = true): Holiday[] {
  return swissHolidays(year)
    .filter((x) => x.cantons.includes(canton))
    .filter((x) => includeUnpaid || x.paid);
}

/** Map YYYY-MM-DD -> Holiday[] für einen Kanton, über mehrere Jahre */
export function holidayMap(years: number[], canton: string, includeUnpaid = true) {
  const map: Record<string, Holiday[]> = {};
  for (const y of years) {
    for (const hd of holidaysForCanton(y, canton, includeUnpaid)) {
      (map[hd.date] ||= []).push(hd);
    }
  }
  return map;
}

export function dateKey(d: Date) {
  return iso(d);
}
