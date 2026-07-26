-- Seed property_faq_entries with the FAQ content transcribed verbatim from
-- app/(public)/horseshoe-bay/faq/faq-data.ts (itself transcribed from the
-- client's faq.html mockup). Multi-paragraph answers are joined with a
-- blank line (\n\n) — the public read splits on that the same way the old
-- FaqCategorySection component split on entry.answer being an array.
-- Once this migration runs, faq-data.ts is dead code and gets deleted; this
-- table becomes the FAQ page's only source.

INSERT INTO property_faq_entries (property_id, category, category_order, question, answer, sort_order)
VALUES
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Membership & Eligibility', 1, 'Are the Sporting Club amenities open to the public?', 'No, the Sporting Club is a private, members-only facility. All range and club amenities are restricted to members and their approved guests. Third-party groups may inquire about group events by emailing info@hsbsportingclub.com.', 1),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Membership & Eligibility', 1, 'Is membership individual or family-based?', 'Membership privileges mirror those of the resort and include the primary member, spouse, and dependents under the age of 26.

Members may designate up to two additional designees (age 21+, not members of the Club at Horseshoe Bay, who reside outside of 25 miles from the club). Individuals must complete a liability release and must be legally permitted to own or possess a firearm.

All Sporting Club members are required to participate in a safety orientation prior to engaging in shooting activities.', 2),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Membership & Eligibility', 1, 'Is there a cart fee?', 'Yes. The fee for both the 4-seat and 6-seat golf carts is $15 (plus tax) per person.', 3),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Membership & Eligibility', 1, 'Is there a membership cap?', 'Membership capacity is currently under review and will be communicated as the club grows.', 4),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Membership & Eligibility', 1, 'Are there corporate memberships?', 'We do not offer corporate memberships at this time.', 5),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Membership & Eligibility', 1, 'Is this part of the Bronco Experience?', 'No. The Sporting Club operates independently, in partnership with The Club at Horseshoe Bay.', 6),

((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Billing & Financial Policies', 2, 'How are charges handled?', 'For convenience, all Sporting Club expenses are applied directly through your existing resort account.', 1),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Billing & Financial Policies', 2, 'Are clay targets and ammunition included in membership fees?', 'Clay targets are included with your membership. Ammunition may be purchased at the clubhouse front desk.', 2),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Billing & Financial Policies', 2, 'Are credit cards accepted?', 'Most charges will be applied to membership accounts, with the exception of booking private training and other on-site events and classes, which is done through the club website and will require credit card payment upon registration.', 3),

((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Location & Access', 3, 'How do I gain access to the Sporting Club?', 'Members will be granted gate access upon onboarding at the club.', 1),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Location & Access', 3, 'Can I drive my personal vehicle to the pistol bays?', 'Yes. Vehicle access to the pistol bays is permitted in accordance with club guidelines. Members must check in at the clubhouse before entering the range.', 2),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Location & Access', 3, 'Are members allowed on property after business hours?', 'No, members will not have access when staff is not present.', 3),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Location & Access', 3, 'Is there a locker room?', 'A shower is available for member convenience. Full locker room facilities are not available at this time.', 4),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Location & Access', 3, 'Are children allowed in all areas of the club?', 'Anyone under age 18 must be accompanied by a legal guardian at all times.', 5),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Location & Access', 3, 'Are pets allowed in the clubhouse and on the range?', 'Yes, dogs are permitted but must be leashed and under the owner''s control at all times.', 6),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Location & Access', 3, 'Do you have meeting spaces?', 'Yes. The clubhouse features a formal conference room, as well as lounge and game room spaces suitable for informal meetings, in addition to private dining areas.', 7),

((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Food & Beverage', 4, 'What food and beverages are offered?', 'Grab-and-go items and beverages are available for purchase in the clubhouse. The clubhouse also features a complimentary espresso bar. Our full bar, The Last Shot, located in the Trophy Room, serves craft cocktails and beer.', 1),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Food & Beverage', 4, 'Do you offer catering?', 'Catering is available through the resort and can be arranged by contacting the club concierge.', 2),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Food & Beverage', 4, 'What is the club''s alcohol policy?', 'No alcohol or mind-altering substances, including medications that impair judgment or coordination, may be consumed before or during shooting activities. Outside alcohol is not permitted at the club. The club reserves the right to prohibit participation in shooting by anyone who appears impaired. The club maintains a zero-tolerance alcohol policy.', 3),

((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Guest Policies & Access', 5, 'Are there guest fees?', 'Yes, there is an $85 per person guest fee. All guest charges (including food and beverage and retail), whether for members of the Club at Horseshoe Bay or non-members, will be applied to the host''s Sporting Club member account. Cart usage for guests is included in the fee. Junior guests (age 15 and younger) enjoy a $55 guest fee that includes clays and cart fee.', 1),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Guest Policies & Access', 5, 'Is there a limit to the number of guests I may bring?', 'Members may bring up to five guests at a time. Groups larger than six require approval from the General Manager.', 2),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Guest Policies & Access', 5, 'How many times may an individual visit the Sporting Club as a guest?', 'Guests may visit the club no more than three times per year.', 3),

((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Shooting Disciplines & Facilities', 6, 'What shooting activities are offered?', 'The club features 12 covered sporting clays stations, one flurry deck, two shooting decks (5 stand, knockout, and other shotgun games), one Helice ring, and 4 pistol and carbine shooting bays (9mm to 5.56).', 1),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Shooting Disciplines & Facilities', 6, 'Do you offer skeet and trap?', 'Skeet and trap fields are not part of the initial launch phase but may be considered in future development phases.', 2),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Shooting Disciplines & Facilities', 6, 'Will there be long-range shooting opportunities?', 'Long-range shooting is not available on-site. Packsaddle Precision, a new long-range shooting facility located 15 minutes west of the club, will open in 2026. Sporting Club members will have first access to join at a discounted rate.', 3),

((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Range Operations & Rules', 7, 'What are the age requirements to shoot on the range?', 'Anyone under 18 must be accompanied by a legal guardian.', 1),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Range Operations & Rules', 7, 'Can members request specific bay setups?', 'Yes, with 24-hour notice. Setups can be requested by calling the club concierge line.', 2),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Range Operations & Rules', 7, 'Can I reserve pistol bays?', 'While not required, pistol bays are available to reserve by calling or emailing the club, or visiting the concierge desk.', 3),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Range Operations & Rules', 7, 'What rifle calibers are permitted in the bays?', 'The maximum caliber permitted is 5.56 / 300 Blackout.', 4),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Range Operations & Rules', 7, 'Can I zero in my rifle on the range?', 'Yes, up to 50 yards.', 5),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Range Operations & Rules', 7, 'What types of targets are available on the pistol bays?', 'Paper targets, static steel, and moving steel targets are available.', 6),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Range Operations & Rules', 7, 'What shotgun loads are allowed?', 'Lead shot only, with no sizes larger than 7.5, 8, and 9.', 7),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Range Operations & Rules', 7, 'Are there any barrel restrictions on shotguns?', 'For clay target shooting the minimum barrel length is 24 inches. Shorter barrels may be used on the pistol bays.', 8),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Range Operations & Rules', 7, 'How many throwers are at each sporting clays station, and how often are they rotated?', 'For each station there are 4 throwers. Target presentations are rotated regularly.', 9),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Range Operations & Rules', 7, 'Does the club accept course-setting requests?', 'Yes, requests can be made directly to the General Manager by email or in person.', 10),

((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Instruction, Training & Classes', 8, 'Do you offer private and group instruction?', 'Yes, private instruction and group classes are available for shotgun, pistol, and carbine disciplines.', 1),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Instruction, Training & Classes', 8, 'Will you offer concealed carry classes?', 'Yes, members will be able to schedule private concealed carry classes through the club website.', 2),

((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Retail, Rentals & Storage', 9, 'Can I buy ammunition and gear on-site?', 'Yes, ammunition is available for purchase. A curated selection of retail items is available in the pro shop.', 1),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Retail, Rentals & Storage', 9, 'What firearms are available for rent, and in which gauges?', 'The club offers a selection of shotguns, pistols, and rifles available to rent. See the concierge desk for details.', 2),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Retail, Rentals & Storage', 9, 'Do you sell firearms?', 'No, firearms are not for sale through the club.', 3),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Retail, Rentals & Storage', 9, 'Do you offer storage for members'' firearms and ammunition?', 'No, not at this time.', 4),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Retail, Rentals & Storage', 9, 'Do members receive their 20% savings on retail, food, and beverage?', 'Yes, these items are priced with the Club at Horseshoe Bay members'' discount in place.', 5),

((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Events, Leagues & Tournaments', 10, 'Are leagues, tournaments, and social events offered?', 'Yes. The club offers a range of events including league nights, club tournaments, and exclusive Members'' Dinners. All events are posted on the club website''s event calendar page.', 1),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Events, Leagues & Tournaments', 10, 'Will there be NSCA-registered events?', 'No, registered NSCA shoots are not currently planned.', 2),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Events, Leagues & Tournaments', 10, 'How do I plan an event?', 'All events can be scheduled and coordinated directly through the club concierge or General Manager.', 3),

((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Hunting & Experiences', 11, 'Are hunting experiences offered?', 'Yes. The club will offer wing-shooting training as well as guided hunting experiences at select domestic and international locations. Our hunting program will launch soon.', 1),

((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Safety & Emergency Procedures', 12, 'What are the shooting rules?', 'All members must follow strict safety protocols, including firearm handling standards, range etiquette, and caliber restrictions. Complete rules are provided in the Rules section of the Welcome Guide.', 1),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Safety & Emergency Procedures', 12, 'Is there an emergency plan in place?', 'Yes. Staff are trained to respond to emergencies, contact emergency services, and provide critical information. Emergency procedures are posted throughout the range and clubhouse area.', 2),

((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Property & Team', 13, 'How large is the property?', 'The club spans over 150 acres, encompassing ranges and clubhouse facilities designed for both shooting and leisure. The property offers scenic Hill Country views, whether you are enjoying the course or socializing with friends.', 1),
((SELECT id FROM properties WHERE slug = 'horseshoe-bay'), 'Property & Team', 13, 'Who oversees operations at the Horseshoe Bay Sporting Club?', 'Rhythm Outdoors, an experienced sporting club operator, with Adam McCaw serving as General Manager.', 2);
