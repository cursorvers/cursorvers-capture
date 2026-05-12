
export function isValidEmail(email: string): boolean {
  const emailRegex = new RegExp(
    "^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|\"(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21\\x23-\\x5b\\x5d-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])*\")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+([a-zA-Z]{2,}))$",
    "i"
  );
  return emailRegex.test(email);
}export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function compareEmails(a: string, b: string): boolean {
  return normalizeEmail(a) === normalizeEmail(b);
}
