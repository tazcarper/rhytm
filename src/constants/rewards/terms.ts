import { REWARDS_PROGRAM } from "@/src/constants/rewards/program";

// Member Rewards Program terms, shown at /member/rewards/terms.
//
// Built 2026-11-08 from common clauses in published U.S. loyalty program
// terms (eligibility, earning, redemption, no cash value, non-transfer,
// expiration, changes/termination, fraud, liability, governing law) and
// the client's program rules. Texas note: Bus. & Com. Code §604.002(3)
// excludes cards/credits given under a rewards or loyalty program — and
// not bought with money — from the state's stored-value card rules, which
// is why points must never be sold. HAVE COUNSEL REVIEW BEFORE LAUNCH.
//
// Numbers come from REWARDS_PROGRAM so the terms can't drift from the code.

export const REWARDS_TERMS_EFFECTIVE_DATE = "November 8, 2026";

export interface TermsSection {
  heading: string;
  paragraphs: ReadonlyArray<string>;
}

const p = REWARDS_PROGRAM;
const stepValue = (p.redemptionStep * p.dollarsPerPoint).toFixed(0);

export const REWARDS_TERMS: ReadonlyArray<TermsSection> = [
  {
    heading: "About the program",
    paragraphs: [
      "The Rhythm Outdoors Member Rewards Program (the “Program”) is offered by Rhythm Outdoors and its clubs — Horseshoe Bay Sporting Club, Hog Heaven Sporting Club, and Packsaddle Precision (“we,” “us”). By earning or using points you agree to these terms. The Program is free and is a courtesy to our members; it is not a contract to provide any particular reward.",
    ],
  },
  {
    heading: "Who can take part",
    paragraphs: [
      "The Program is open only to active members. Points belong to the membership (the household), not to an individual: everyone on a membership earns into and spends from one shared balance. The primary member is responsible for the account.",
      "Each membership belongs to one club, and its points are kept separately. Points earned at one club can only be used at that club.",
    ],
  },
  {
    heading: "Earning points",
    paragraphs: [
      `You earn ${p.pointsPerDollar} point for every whole $1 you actually pay, after discounts and after any points applied. Points are not earned on the part of a purchase paid with points, or on amounts that are later refunded.`,
      "To earn, the purchase must be tied to your membership: book while signed in to your member account, enter your member number and last name before paying online, or give your member number to staff when you pay at the club. Online payments earn automatically once the payment is confirmed. Payments made at the club are added by staff and may take a few days to appear.",
      "If points are missing, tell us within 90 days of the purchase and we will look into it.",
    ],
  },
  {
    heading: "Using points",
    paragraphs: [
      `Every ${p.redemptionStep} points is worth $${stepValue} off eligible purchases at the club where they were earned, such as event and booking deposits, lessons, and merchandise. Points are used in blocks of ${p.redemptionStep}.`,
      `Online, a signed-in member can apply points when paying a booking deposit. At least $${p.minimumCardChargeUsd.toFixed(2)} of any online payment must be paid by card. At the club, ask staff before you pay; they will take the discount off and record the points used.`,
      "We may exclude some items from earning or using points, such as membership dues, gift cards, or third-party services, and we will tell you before you pay.",
    ],
  },
  {
    heading: "Points are not money",
    paragraphs: [
      "Points have no cash value. They cannot be exchanged for cash, refunded, sold, bartered, or transferred to anyone outside your membership, and they do not earn interest. Points are not a gift card, gift certificate, or stored-value card, and they are never sold. Points are a promotional benefit, not your property.",
    ],
  },
  {
    heading: "Expiration",
    paragraphs: [
      `Points can be used until ${p.expiryMonths} months after the last time your household earned or used points. Every time you earn or use points, that date moves out to ${p.expiryMonths} months from then. Your current date is shown in your member profile.`,
      "After that date, the points can no longer be used. We keep a record of the balance, and we may, but are not required to, reinstate expired points.",
    ],
  },
  {
    heading: "Refunds, cancellations, and corrections",
    paragraphs: [
      "If a payment that earned points is refunded or reversed, we remove the points it earned. If a purchase you paid for partly with points is cancelled and refunded, we return those points to your balance instead of paying out their value. A balance may go below zero if points were already used; future points will bring it back up.",
      "We may correct any points posted in error. Every change to your balance appears in your account activity.",
    ],
  },
  {
    heading: "If your membership ends",
    paragraphs: [
      "Points can only be used while the membership is active. If a membership lapses, is suspended, or ends, its points cannot be used. If the membership becomes active again, we may restore the balance at our discretion.",
    ],
  },
  {
    heading: "Fraud and misuse",
    paragraphs: [
      "We may withhold, remove, or refuse points, or remove a membership from the Program, if we believe points were earned or used through fraud, misuse, error, or a violation of these terms or club rules.",
    ],
  },
  {
    heading: "Changes to the program",
    paragraphs: [
      "We may change these terms, the earning rate, the value of points, or which purchases qualify. When a change reduces the value of your points, we will try to give at least 30 days’ notice in your member profile or by email. Continuing to take part after a change means you accept it.",
      "We may end the Program. If we do, we will give at least 60 days’ notice, and you can use your points until the end date. Points not used by then are cancelled.",
    ],
  },
  {
    heading: "Taxes",
    paragraphs: [
      "Taxes are calculated on the price after points are applied, unless the law requires otherwise. You are responsible for any taxes that may apply to rewards you receive.",
    ],
  },
  {
    heading: "Your information",
    paragraphs: [
      "We use your membership, purchase, and points history to run the Program and to suggest ways to use your points. We do not sell this information.",
    ],
  },
  {
    heading: "Limits on our responsibility",
    paragraphs: [
      "The Program is provided “as is.” We are not responsible for points lost because of system errors, outages, or circumstances outside our control, beyond correcting your balance when we can confirm the error. To the extent the law allows, our total responsibility for any claim about the Program is limited to the dollar value of the points in question.",
    ],
  },
  {
    heading: "Governing law",
    paragraphs: [
      "These terms are governed by the laws of the State of Texas. If any part of them is found unenforceable, the rest still applies.",
    ],
  },
  {
    heading: "Questions",
    paragraphs: [
      "Ask the staff at your club, or contact the club through its page on our website. Staff can show you your balance and full points history at any time.",
    ],
  },
];
