export function convertToLowercase(text: string, locale?: string | readonly string[]): string {
  return locale === undefined ? text.toLowerCase() : text.toLocaleLowerCase(locale);
}
