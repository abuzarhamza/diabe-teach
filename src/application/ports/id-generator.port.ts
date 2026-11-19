/** Generates unique identifiers, so use cases never call crypto directly. */
export interface IdGeneratorPort {
  generate: () => string;
}
