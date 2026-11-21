/**
 * Removes the `user:pass@` part of any `mongodb://` or `mongodb+srv://`
 * connection string inside a piece of text, such as a MongoDB driver error
 * message, so the text can be logged. The host and the rest stay, which keeps
 * the message useful.
 */
export class MongoCredentialStripper {
  // The authority's userinfo stops at the last `@` before the host; `/` and
  // whitespace end the authority, so the match never runs into later text.
  static readonly #CREDENTIALS = /(mongodb(?:\+srv)?:\/\/)[^\s/]+@/gi;

  public static strip(text: string): string {
    return text.replace(MongoCredentialStripper.#CREDENTIALS, "$1");
  }
}
