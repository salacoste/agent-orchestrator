/**
 * Telegram MarkdownV2 escape utility.
 *
 * Telegram's MarkdownV2 parse_mode requires escaping these characters:
 * _ * [ ] ( ) ~ ` > # + - = | { } . !
 *
 * @see https://core.telegram.org/bots/api#markdownv2-style
 */

const MARKDOWN_V2_SPECIAL = /([_*[\]()~`>#+\-=|{}.!])/g;

/**
 * Escape a string for use in Telegram MarkdownV2 parse_mode.
 */
export function escapeMarkdownV2(text: string): string {
  return text.replace(MARKDOWN_V2_SPECIAL, "\\$1");
}
