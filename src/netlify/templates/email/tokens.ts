/**
 * Shared design tokens for server-rendered emails.
 *
 * Single source of truth for the email palette and font stack. Components in
 * this folder reference these so a colour/font change happens in one place.
 */
export const fontFamily =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif'

export const colors = {
  text: '#000000',
  muted: '#888888',
  background: '#ffffff',
  divider: '#eeeeee', // internal dividers (order summary, section separators)
  border: '#27272a', // container outline (zinc-800)
  buttonBackground: '#000000',
  buttonText: '#ffffff',
}
