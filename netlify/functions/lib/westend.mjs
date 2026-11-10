// Cab Books – West End and other long-running shows: their regular weekly times and running times,
// so Tonight can say when each one lets out (Matt, 10 Nov 2026).
// This is a list we keep ourselves. Shows open and close, and holiday weeks (Christmas, New Year) run
// different times, so check it about once a month. CHECKED is shown to drivers.
// perf: start times by day (London time). mins: running time including the interval.
// varies: the programme changes (opera, dance): the time is the usual evening one and shows with a "?".
export const CHECKED = '2026-11-10';
// First list researched 10 Nov 2026 from show and theatre listings (Official London Theatre, londontheatre.co.uk,
// Delfont Mackintosh, LW Theatres, Nimax, ATG, SeatPlan and others). Low-confidence ones are marked varies ("?").
export const SHOWS = [
  {"theatre": "Lyceum Theatre", "area": "Strand", "show": "The Lion King", "perf": {"mon": [], "tue": ["19:30"], "wed": ["14:30", "19:30"], "thu": ["19:30"], "fri": ["19:30"], "sat": ["14:30", "19:30"], "sun": ["14:30"]}, "mins": 150},
  {"theatre": "Apollo Victoria Theatre", "area": "Victoria", "show": "Wicked", "perf": {"mon": [], "tue": ["19:30"], "wed": ["14:30", "19:30"], "thu": ["19:30"], "fri": ["19:30"], "sat": ["14:30", "19:30"], "sun": ["14:30"]}, "mins": 165},
  {"theatre": "Sondheim Theatre", "area": "Shaftesbury Ave", "show": "Les Misérables", "perf": {"mon": ["19:30"], "tue": ["19:30"], "wed": ["19:30"], "thu": ["14:30", "19:30"], "fri": ["19:30"], "sat": ["14:30", "19:30"], "sun": []}, "mins": 170},
  {"theatre": "His Majesty's Theatre", "area": "Haymarket", "show": "The Phantom of the Opera", "perf": {"mon": ["19:30"], "tue": ["19:30"], "wed": ["14:30", "19:30"], "thu": ["19:30"], "fri": ["19:30"], "sat": ["14:30", "19:30"], "sun": []}, "mins": 150},
  {"theatre": "Victoria Palace Theatre", "area": "Victoria", "show": "Hamilton", "perf": {"mon": ["19:30"], "tue": ["19:30"], "wed": ["19:30"], "thu": ["14:30", "19:30"], "fri": ["19:30"], "sat": ["14:30", "19:30"], "sun": []}, "mins": 165},
  {"theatre": "Novello Theatre", "area": "Aldwych", "show": "Mamma Mia!", "perf": {"mon": ["19:30"], "tue": ["19:30"], "wed": ["19:30"], "thu": ["15:00", "19:30"], "fri": ["19:30"], "sat": ["15:00", "19:30"], "sun": []}, "mins": 155},
  {"theatre": "Prince of Wales Theatre", "area": "Leicester Square", "show": "The Book of Mormon", "perf": {"mon": ["19:30"], "tue": ["19:30"], "wed": ["19:30"], "thu": ["19:30"], "fri": ["14:30", "19:30"], "sat": ["14:30", "19:30"], "sun": []}, "mins": 140},
  {"theatre": "St Martin's Theatre", "area": "Cambridge Circus", "show": "The Mousetrap", "perf": {"mon": ["19:30"], "tue": ["19:00"], "wed": ["15:00", "19:30"], "thu": ["19:00"], "fri": ["15:00", "19:30"], "sat": ["15:00", "19:30"], "sun": []}, "mins": 125},
  {"theatre": "Cambridge Theatre", "area": "Seven Dials", "show": "Matilda", "perf": {"mon": [], "tue": ["19:00"], "wed": ["14:00", "19:00"], "thu": ["19:00"], "fri": ["19:00"], "sat": ["14:00", "19:00"], "sun": ["14:00"]}, "mins": 155},
  {"theatre": "Palace Theatre", "area": "Cambridge Circus", "show": "Harry Potter and the Cursed Child", "perf": {"mon": [], "tue": ["19:00"], "wed": ["13:00", "19:00"], "thu": ["19:00"], "fri": ["19:00"], "sat": ["13:00", "19:00"], "sun": ["14:30"]}, "mins": 175},
  {"theatre": "ABBA Arena", "area": "Stratford (Pudding Mill Lane)", "show": "ABBA Voyage", "perf": {"mon": ["19:45"], "tue": [], "wed": ["19:45"], "thu": ["19:45"], "fri": ["19:45"], "sat": ["15:00", "19:45"], "sun": ["13:00", "18:00"]}, "mins": 100, "varies": true},
  {"theatre": "Adelphi Theatre", "area": "Strand", "show": "The Lives of Others", "perf": {"mon": ["19:30"], "tue": ["19:30"], "wed": ["14:30", "19:30"], "thu": ["19:30"], "fri": ["19:30"], "sat": ["14:30", "19:30"], "sun": []}, "mins": 130, "until": "2027-01-09"},
  {"theatre": "Prince Edward Theatre", "area": "Soho", "show": "Beetlejuice", "perf": {"mon": ["19:30"], "tue": ["19:30"], "wed": ["19:30"], "thu": ["19:30"], "fri": ["14:30", "19:30"], "sat": ["14:30", "19:30"], "sun": []}, "mins": 160, "until": "2027-01-02"},
  {"theatre": "Piccadilly Theatre", "area": "Piccadilly Circus", "show": "Moulin Rouge!", "perf": {"mon": ["19:30"], "tue": ["19:30"], "wed": ["19:30"], "thu": ["14:30", "19:30"], "fri": ["19:30"], "sat": ["14:30", "19:30"], "sun": []}, "mins": 155},
  {"theatre": "Theatre Royal Drury Lane", "area": "Covent Garden", "show": "Jesus Christ Superstar", "perf": {"mon": ["19:30"], "tue": ["19:30"], "wed": ["19:30"], "thu": ["14:30", "19:30"], "fri": ["19:30"], "sat": ["14:30", "19:30"], "sun": []}, "mins": 120, "until": "2027-01-09"},
  {"theatre": "London Palladium", "area": "Oxford Circus", "show": "Show varies nightly", "perf": {"mon": ["19:30"], "tue": ["19:30"], "wed": ["19:30"], "thu": ["19:30"], "fri": ["19:30"], "sat": ["19:30"], "sun": ["19:30"]}, "mins": 150, "varies": true},
  {"theatre": "Gillian Lynne Theatre", "area": "Holborn", "show": "My Neighbour Totoro", "perf": {"mon": [], "tue": ["19:00"], "wed": ["19:00"], "thu": ["14:00", "19:00"], "fri": ["19:00"], "sat": ["14:00", "19:00"], "sun": ["14:00"]}, "mins": 160, "until": "2027-01-03"},
  {"theatre": "Savoy Theatre", "area": "Strand", "show": "Paddington The Musical", "perf": {"mon": ["19:00"], "tue": [], "wed": ["19:00"], "thu": ["14:00", "19:00"], "fri": ["19:00"], "sat": ["14:00", "19:00"], "sun": ["14:00"]}, "mins": 165},
  {"theatre": "Duchess Theatre", "area": "Covent Garden", "show": "The Play That Goes Wrong", "perf": {"mon": [], "tue": ["19:30"], "wed": ["19:30"], "thu": ["19:30"], "fri": ["19:30"], "sat": ["14:30", "19:30"], "sun": ["15:00", "19:00"]}, "mins": 120},
  {"theatre": "Vaudeville Theatre", "area": "Strand", "show": "SIX", "perf": {"mon": [], "tue": ["20:00"], "wed": ["20:00"], "thu": ["16:00", "20:00"], "fri": ["20:00"], "sat": ["16:00", "20:00"], "sun": ["15:00", "19:00"]}, "mins": 80},
  {"theatre": "Gielgud Theatre", "area": "Shaftesbury Ave", "show": "Oliver!", "perf": {"mon": [], "tue": ["19:00"], "wed": ["14:30", "19:30"], "thu": ["19:30"], "fri": ["19:30"], "sat": ["14:30", "19:30"], "sun": ["14:30"]}, "mins": 160},
  {"theatre": "Lyric Theatre", "area": "Shaftesbury Ave", "show": "Hadestown", "perf": {"mon": [], "tue": ["19:00"], "wed": ["19:00"], "thu": ["14:30", "19:30"], "fri": ["19:30"], "sat": ["14:30", "19:30"], "sun": ["15:00"]}, "mins": 150},
  {"theatre": "Dominion Theatre", "area": "Tottenham Court Rd", "show": "The Devil Wears Prada", "perf": {"mon": ["19:30"], "tue": ["19:30"], "wed": ["14:30", "19:30"], "thu": ["19:30"], "fri": ["19:30"], "sat": ["14:30", "19:30"], "sun": []}, "mins": 150},
  {"theatre": "Playhouse Theatre", "area": "Embankment", "show": "Cabaret (Kit Kat Club)", "perf": {"mon": ["19:30"], "tue": ["19:00"], "wed": ["14:00", "19:30"], "thu": ["19:30"], "fri": ["19:30"], "sat": ["14:00", "19:30"], "sun": []}, "mins": 165},
  {"theatre": "Phoenix Theatre", "area": "Charing Cross Rd", "show": "Stranger Things: The First Shadow", "perf": {"mon": [], "tue": ["19:00"], "wed": ["19:00"], "thu": ["19:00"], "fri": ["13:00", "19:00"], "sat": ["13:00", "19:00"], "sun": ["15:00"]}, "mins": 180, "until": "2026-12-27"},
  {"theatre": "Fortune Theatre", "area": "Covent Garden", "show": "Operation Mincemeat", "perf": {"mon": ["19:30"], "tue": ["15:00", "19:30"], "wed": ["19:30"], "thu": ["19:30"], "fri": ["19:30"], "sat": ["15:00", "19:30"], "sun": []}, "mins": 155},
  {"theatre": "Shaftesbury Theatre", "area": "High Holborn", "show": "Avenue Q", "perf": {"mon": ["19:30"], "tue": ["19:30"], "wed": ["19:30"], "thu": ["19:30"], "fri": ["19:30"], "sat": ["14:30", "19:30"], "sun": []}, "mins": 135, "until": "2027-01-03"},
  {"theatre": "Aldwych Theatre", "area": "Aldwych", "show": "Sinatra The Musical", "perf": {"mon": [], "tue": ["14:30", "19:30"], "wed": ["19:30"], "thu": ["14:30", "19:30"], "fri": ["19:30"], "sat": ["14:30", "19:30"], "sun": []}, "mins": 165, "until": "2027-04-10"},
  {"theatre": "Peacock Theatre", "area": "Holborn", "show": "Show varies (dance, The Snowman)", "perf": {"mon": ["19:30"], "tue": ["19:30"], "wed": ["19:30"], "thu": ["19:30"], "fri": ["19:30"], "sat": ["14:30", "19:30"], "sun": ["15:00"]}, "mins": 100, "varies": true, "from": "2026-11-15"},
  {"theatre": "The Old Vic", "area": "Waterloo", "show": "A Christmas Carol", "perf": {"mon": ["19:30"], "tue": ["19:30"], "wed": ["19:30"], "thu": ["19:30"], "fri": ["19:30"], "sat": ["14:30", "19:30"], "sun": []}, "mins": 120, "varies": true, "from": "2026-11-12", "until": "2027-01-09"},
  {"theatre": "London Coliseum", "area": "St Martin's Lane", "show": "English National Opera", "perf": {"mon": ["19:30"], "tue": ["19:30"], "wed": ["19:30"], "thu": ["19:30"], "fri": ["19:30"], "sat": ["18:00"], "sun": []}, "mins": 130, "varies": true},
  {"theatre": "Sadler's Wells Theatre", "area": "Angel", "show": "Dance (varies)", "perf": {"mon": [], "tue": ["19:30"], "wed": ["19:30"], "thu": ["19:30"], "fri": ["19:30"], "sat": ["19:30"], "sun": []}, "mins": 120, "varies": true},
  // Concert halls (Matt, 10 Nov 2026): their own sites don't give nightly times in a readable form, so the usual
  // evening times, marked "?". Some nights nothing is on. A reader for the Royal Opera House's own pages is on the to-do list.
  {"theatre": "Royal Opera House", "area": "Covent Garden", "show": "Opera or ballet (programme varies)", "perf": {"mon": ["19:30"], "tue": ["19:30"], "wed": ["19:30"], "thu": ["19:30"], "fri": ["19:30"], "sat": ["19:30"], "sun": []}, "mins": 150, "varies": true},
  {"theatre": "Barbican Hall", "area": "Barbican", "show": "Concert (programme varies)", "perf": {"mon": ["19:30"], "tue": ["19:30"], "wed": ["19:30"], "thu": ["19:30"], "fri": ["19:30"], "sat": ["19:30"], "sun": ["19:30"]}, "mins": 135, "varies": true},
  {"theatre": "Royal Festival Hall", "area": "Southbank", "show": "Concert (programme varies)", "perf": {"mon": ["19:30"], "tue": ["19:30"], "wed": ["19:30"], "thu": ["19:30"], "fri": ["19:30"], "sat": ["19:30"], "sun": ["19:30"]}, "mins": 120, "varies": true},
  {"theatre": "Wigmore Hall", "area": "Marylebone", "show": "Concert (programme varies)", "perf": {"mon": ["19:30"], "tue": ["19:30"], "wed": ["19:30"], "thu": ["19:30"], "fri": ["19:30"], "sat": ["19:30"], "sun": ["19:30"]}, "mins": 120, "varies": true},
  {"theatre": "Cadogan Hall", "area": "Sloane Square", "show": "Concert (programme varies)", "perf": {"mon": ["19:30"], "tue": ["19:30"], "wed": ["19:30"], "thu": ["19:30"], "fri": ["19:30"], "sat": ["19:30"], "sun": ["19:30"]}, "mins": 135, "varies": true}
];

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export function londonToUtc(day, hm) {
  const [h, m] = hm.split(':').map(Number);
  const guess = Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10), h, m);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(new Date(guess)).map(x => [x.type, x.value]));
  const off = ((+p.hour % 24) * 60 + +p.minute) - (h * 60 + m);
  return new Date(guess - off * 60000).toISOString();
}
export function westEndEvents(day, shows = SHOWS) {
  const dow = DAYS[new Date(day + 'T12:00:00Z').getUTCDay()], out = [];
  for (const s of shows) {
    if ((s.from && day < s.from) || (s.until && day > s.until)) continue;
    for (const t of (s.perf && s.perf[dow]) || []) {
      const start = londonToUtc(day, t);
      out.push({
        kind: 'show', title: s.show, venue: s.theatre, area: s.area || '', start,
        finish: new Date(Date.parse(start) + s.mins * 60000).toISOString(),
        note: (+t.slice(0, 2) < 17 ? 'matinee' : '') , guess: !!s.varies, src: 'westend',
      });
    }
  }
  return out;
}
