export interface EnvYamlMongoConfig {
  readonly uri?: string;
  readonly database?: string;
}

export interface EnvYamlAuthConfig {
  readonly capability_token_secret?: string;
  readonly api_key?: string;
}

export interface EnvYamlConfig {
  readonly mongodb?: EnvYamlMongoConfig;
  readonly auth?: EnvYamlAuthConfig;
}

export interface ResolvedEnvConfig {
  readonly mongoUri?: string;
  readonly mongoDbName: string;
  readonly capabilityTokenSecret?: string;
  readonly apiKey?: string;
}
