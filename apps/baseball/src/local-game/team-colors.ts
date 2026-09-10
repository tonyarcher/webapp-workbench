const TEAM_COLORS: Record<string, string> = {
  'Chicago Cubs': '#1d4ed8',
  'St. Louis Cardinals': '#c8102e',
  'Springfield Isotopes': '#e63946',
  'New York Knights': '#1e3a8a',
  'Durham Bulls': '#003087',
  'Rockford Peaches': '#d7263d',
  'Portland Pickles': '#2f9e44',
  'Savannah Bananas': '#e8b400',
  'Kansas City Monarchs': '#2b3a8f',
  'Brooklyn Cyclones': '#0b4ea2',
  'Toledo Mud Hens': '#e8762c',
  'Hartford Yard Goats': '#1f7a8c',
  'Sugar Land Space Cowboys': '#e8762c',
  'Rocket City Trash Pandas': '#d7263d',
  'El Paso Chihuahuas': '#c8102e',
  'Amarillo Sod Poodles': '#1f3a93',
  'Columbus Clippers': '#b31b1b',
  'Las Vegas Aviators': '#e0a800',
  'Round Rock Express': '#1c3f94',
  'Omaha Storm Chasers': '#1d4ed8',
  'Scranton RailRiders': '#b31b1b',
  'Albuquerque Rose Sox': '#d6336c',
};

/** Primary team color, with a stable hue for names the map does not know. */
export function teamPrimaryColor(name: string): string {
  const known = TEAM_COLORS[name];
  if (known) return known;
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return `hsl(${hash % 360} 78% 58%)`;
}
