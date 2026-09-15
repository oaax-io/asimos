import {
  Accessibility, Baby, Ban, Bath, Blocks, Car, CarFront, Cigarette, Dog, Flame, Fence,
  Gauge, Hammer, Home, Landmark, Layers, Leaf, Lightbulb, MapPin, Mountain, Move3d,
  ParkingSquare, PlugZap, Recycle, Ruler, ShieldCheck, Sparkles, Sun, Trees, Tv, Video,
  Volume2, Warehouse, Waves, Wind, WashingMachine, Building2, Sofa, KeyRound,
  type LucideIcon,
} from "lucide-react";

const BY_KEY: Record<string, LucideIcon> = {
  auslaenderkontingent: Landmark,
  haustiere_erlaubt: Dog,
  projektiert: Ruler,
  balkon: Sun,
  hochparterre: Layers,
  rollstuhlgaengig: Accessibility,
  bauland_erschlossen: Hammer,
  im_baurecht: Landmark,
  ruhig: Volume2,
  bergsicht: Mountain,
  in_wohngemeinschaft: Home,
  seesicht: Waves,
  carport: CarFront,
  kabelfernsehen: Tv,
  sommerlaube: Trees,
  cheminee: Flame,
  kachelofen: Flame,
  sonnig: Sun,
  doppelgarage: Warehouse,
  kinderfreundlich: Baby,
  suedhang: Sun,
  eckhaus: Building2,
  ladestation_elektroauto: PlugZap,
  swimmingpool: Waves,
  erdgeschoss: Layers,
  lift: Move3d,
  tumbler: Wind,
  erstwohnsitz: KeyRound,
  mietkautionsgarantie: ShieldCheck,
  virtuelle_besichtigung: Video,
  garage: Warehouse,
  multimediale_verkabelung: Tv,
  waschmaschine: WashingMachine,
  gasanschluss: Gauge,
  nichtraucher: Cigarette,
  zweitwohnsitz: Home,
  hanglage: Mountain,
  parkplatz: ParkingSquare,
  zwischennutzung: Recycle,
  // Basis-Ausstattungen
  terrasse: Sun,
  garten: Trees,
  keller: Blocks,
  moebliert: Sofa,
};

const BY_WORD: Array<[RegExp, LucideIcon]> = [
  [/balkon|terrass|sonn/i, Sun],
  [/garten|grün|baum/i, Trees],
  [/garage|einstellhalle/i, Warehouse],
  [/park/i, ParkingSquare],
  [/auto|carport|fahrzeug/i, Car],
  [/lift|aufzug/i, Move3d],
  [/keller|abstell/i, Blocks],
  [/bad|dusche|wc/i, Bath],
  [/heiz|cheminee|ofen|feuer/i, Flame],
  [/see|pool|wasser/i, Waves],
  [/berg|hang/i, Mountain],
  [/strom|elektro|lade/i, PlugZap],
  [/tv|kabel|multimedia|internet/i, Tv],
  [/wasch|tumbler/i, WashingMachine],
  [/rauch/i, Ban],
  [/kind|familie/i, Baby],
  [/rollstuhl|barrierefrei/i, Accessibility],
  [/lage|zone|quartier/i, MapPin],
  [/licht|hell/i, Lightbulb],
  [/energie|minergie|nachhaltig/i, Leaf],
  [/zaun|umzäunt/i, Fence],
];

/** Passendes Icon für eine Ausstattung, mit sinnvollem Fallback. */
export function featureIcon(key?: string | null, label?: string | null): LucideIcon {
  if (key && BY_KEY[key]) return BY_KEY[key];
  const text = `${key ?? ""} ${label ?? ""}`;
  for (const [re, Icon] of BY_WORD) if (re.test(text)) return Icon;
  return Sparkles;
}
