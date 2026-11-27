declare module "@usebruno/lang" {
  export interface BruParsedRequest {
    readonly meta?: {
      readonly name?: string;
      readonly type?: string;
      readonly seq?: string | number;
    };
    readonly http?: {
      readonly method?: string;
      readonly url?: string;
      readonly body?: string;
      readonly auth?: string;
    };
    readonly body?: {
      readonly json?: string;
    };
    readonly docs?: string;
    readonly script?: {
      readonly req?: string;
      readonly res?: string;
    };
  }

  export interface BruParsedEnvironment {
    readonly variables: ReadonlyArray<{
      readonly name: string;
      readonly value?: string;
      readonly secret?: boolean;
      readonly enabled?: boolean;
    }>;
  }

  export interface BruParsedCollection {
    readonly docs?: string;
    readonly headers?: ReadonlyArray<{
      readonly name: string;
      readonly value: string;
      readonly enabled?: boolean;
    }>;
  }

  const bruLang: {
    readonly bruToJsonV2: (content: string) => BruParsedRequest;
    readonly bruToEnvJsonV2: (content: string) => BruParsedEnvironment;
    readonly collectionBruToJson: (content: string) => BruParsedCollection;
  };

  export default bruLang;
}
