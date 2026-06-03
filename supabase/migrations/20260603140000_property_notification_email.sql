-- Property staff notification email — App 9.
--
-- Where each property's "new booking request — review needed" alert is sent
-- when a guest submits a bid. Config-in-DB (admin-editable on the property
-- settings form), per property so each location can route to its own inbox.
-- Null → no staff alert is sent for that property (the email handler skips
-- it) until an address is configured.

ALTER TABLE properties
  ADD COLUMN notification_email text;

COMMENT ON COLUMN properties.notification_email IS
  'Staff inbox for new-booking-request review alerts (App 9 send-new-bid-staff-notification). Null skips the alert for this property.';
