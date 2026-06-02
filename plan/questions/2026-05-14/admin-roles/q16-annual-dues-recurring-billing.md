# Q16 — Annual dues and recurring billing

**Category:** Admin & Roles
**Status:** Open · surfaced 2026-05-14
**Blocks:** Stripe Subscription vs Invoice setup · member status field logic (active/lapsed/suspended) · Inngest renewal reminder workflow · whether card-on-file storage is required at application time

## Context

The vision covers initiation dues (paid once at application) but is silent on
annual membership dues. Sporting clubs almost always charge ongoing annual or
monthly dues in addition to the initiation fee. If Rhythm charges annual dues,
the system needs to handle recurring billing — either via Stripe Subscriptions
(fully automated, card charged at renewal) or Stripe Invoices (a payment link
sent to the member at renewal time, paid manually). Automated renewals are
cleaner operationally but require the member's card to stay on file. Manual
invoicing gives the team a yearly touchpoint but creates a collection task.

## The questions

- Does HSB (and Hog Heaven) charge annual membership dues in addition to the initiation fee?
- If yes, how are dues currently collected — invoice, check, card on file?
- Should the system automate annual renewal billing via Stripe, or send the member a payment link each year to pay manually?
- Does a member lose portal access if dues lapse, and if so after how long?

## Answer

_(pending)_
