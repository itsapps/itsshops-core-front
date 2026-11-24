/**
 * Field flags the customer enables in `users.registrationFields`. Each flag
 * unhides the matching field(s) in the registration form.
 *
 * - `prename`, `lastname`: required when shown.
 * - `phone`: shown but always optional (server doesn't enforce).
 * - `newsletter`: opt-in checkbox, never required.
 * - `address`: unhides the full address block — line1 + zip + city + country
 *   (required) and line2 + state (optional).
 */
export type UserRegistrationField = 'prename' | 'lastname' | 'phone' | 'newsletter' | 'address'
