-- =============================================================
-- Rich editorial placeholder content for the 5 reference adventures:
-- details.attributes ("type of stay" icon keys), details.highlights
-- (at-a-glance bullets), and details.sections (Matador-style chapters:
-- heading + narrative + image). Powers the long-form public detail page.
--
-- Placeholder copy + Lorem Picsum section images — swap for real content
-- via the future admin editor. Idempotent `details || …` merge, guarded
-- to placeholder rows, matched by title. Dollar-quoted ($j$/$t$) so the
-- narrative apostrophes/dashes need no escaping. Removed with the seed:
-- DELETE … WHERE details->>'placeholder'='true'.
-- =============================================================

UPDATE member_adventures a
SET details = a.details || v.content::jsonb
FROM (VALUES
  ($t$Argentina Dove · Córdoba$t$, $j$ {
    "attributes": ["wingshooting","warm-climate","lodge","all-inclusive","guided","travel","multi-day"],
    "highlights": ["5 nights at a Córdoba estancia","4 full hunting days","All meals & Argentine wine","Bird boys, shells & transfers","Round-trip from the lodge airstrip"],
    "sections": [
      {"heading":"The hunt of a lifetime","body":"Córdoba's volcanic ridges hold the largest resident dove population on earth — millions of birds roosting within minutes of the lodge. Expect non-stop, high-volume passes from first light until you call it, with a bird boy at your side keeping the shells coming and the gun cool. It is, by wide agreement, the finest wingshooting in the world.","image":"https://picsum.photos/seed/cordoba-s1/1400/1000"},
      {"heading":"The estancia","body":"Home for the week is a restored estancia in the foothills — a handful of rooms, a long table, and an asado most evenings under the stars. Mornings start with strong coffee and medialunas; afternoons end with Malbec and the day's stories. The staff outnumber the guests.","image":"https://picsum.photos/seed/cordoba-s2/1400/1000"},
      {"heading":"Getting there","body":"Fly into Córdoba and we handle the rest: private transfer to the estancia, licenses, and gun rental arranged in advance. Bring your own pair or shoot the lodge's 20- and 28-gauges. Four full days in the field, five nights of rest.","image":"https://picsum.photos/seed/cordoba-s3/1400/1000"}
    ]
  } $j$),
  ($t$Founders' Retreat · Pedernales$t$, $j$ {
    "attributes": ["lodge","all-inclusive","temperate","water","guided","multi-day"],
    "highlights": ["By invitation — the Founder class","2 nights on the Pedernales","All meals & open bar","Riverfront cabins","Sporting clays + evening programming"],
    "sections": [
      {"heading":"An inaugural gathering","body":"A weekend held once — for the Founder class who shaped the Club. Two nights on the Pedernales, with the run of the property and a program built around the people in the room.","image":"https://picsum.photos/seed/pedernales-s1/1400/1000"},
      {"heading":"On the river","body":"Cool water, limestone banks, and cypress shade. Paddle, cast a line, or simply sit with a drink while the afternoon runs long.","image":"https://picsum.photos/seed/pedernales-s2/1400/1000"},
      {"heading":"Evenings at the lodge","body":"A sporting-clays round in golden light, then dinner on the porch and a fire after. No agenda you didn't ask for.","image":"https://picsum.photos/seed/pedernales-s3/1400/1000"}
    ]
  } $j$),
  ($t$Texas Hill Country Quail · January$t$, $j$ {
    "attributes": ["wingshooting","dog-work","temperate","lodge","guided","multi-day"],
    "highlights": ["3 nights outside Brady","2 guided hunting days","Wild bobwhite over pointing dogs","Fourth-generation working ranch","Meals & lodging included"],
    "sections": [
      {"heading":"Wild birds, classic dog work","body":"Three days chasing wild bobwhite over seasoned pointing dogs on a fourth-generation ranch outside Brady. Coveys hold tight in the native grass; the dogs do the hard work and the walking is easy.","image":"https://picsum.photos/seed/brady-s1/1400/1000"},
      {"heading":"A working ranch","body":"You'll stay in the ranch house and eat what the kitchen has been cooking for generations. Boots by the door, dogs on the porch, nothing to prove.","image":"https://picsum.photos/seed/brady-s2/1400/1000"},
      {"heading":"The Hill Country in winter","body":"January light, cool mornings, and country that empties out after the holidays. Two guided days afield, with time to spare.","image":"https://picsum.photos/seed/brady-s3/1400/1000"}
    ]
  } $j$),
  ($t$Sonora Whitetail · Late Season$t$, $j$ {
    "attributes": ["big-game","warm-climate","lodge","guided","travel","multi-day"],
    "highlights": ["Managed concession, northern Mexico","Hunted late in the rut","Trophy desert whitetail","Spanish-speaking guides","Lodging, meals & field transport"],
    "sections": [
      {"heading":"Trophy whitetail","body":"A managed concession in northern Mexico, hunted late when the desert whitetail rut is on. Mature bucks, careful glassing, and shots earned over patient mornings.","image":"https://picsum.photos/seed/sonora-s1/1400/1000"},
      {"heading":"The concession","body":"Thousands of acres under long-term management, with a comfortable camp, a full kitchen, and guides who know every draw and water tank.","image":"https://picsum.photos/seed/sonora-s2/1400/1000"},
      {"heading":"Late-season strategy","body":"We time the trip to the rut, when the biggest deer move in daylight. Guides, field transport, and meat care are all handled.","image":"https://picsum.photos/seed/sonora-s3/1400/1000"}
    ]
  } $j$),
  ($t$World Sporting Clays Championship · Spring$t$, $j$ {
    "attributes": ["sporting-clays","travel","guided","multi-day"],
    "highlights": ["Members' travel cohort","Coaching from club instructors","A few practice rounds + the main event","Evening tables together","Dates & destination to be announced"],
    "sections": [
      {"heading":"Shoot the World","body":"Members travel together to the World Sporting Clays Championship — one of the great gatherings on the shooting calendar. Coaching from club instructors, a few practice rounds, and then the main event.","image":"https://picsum.photos/seed/clays-s1/1400/1000"},
      {"heading":"Travel as a cohort","body":"We move as a group: shared transfers, evening tables, and the easy camaraderie of a trip planned end to end. Dates and destination to be announced — members hear first.","image":"https://picsum.photos/seed/clays-s2/1400/1000"}
    ]
  } $j$)
) AS v(title, content)
WHERE a.title = v.title
  AND a.details->>'placeholder' = 'true';
