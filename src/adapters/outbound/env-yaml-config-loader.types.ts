export interface EnvYamlMongoConfig {
  readonly uri?: string;
  readonly database?: string;
}

export interface EnvYamlAuthConfig {
  readonly capability_token_secret?: string;
  readonly account_token_secret?: string;
  readonly api_key?: string;
}

export interface EnvYamlLoggingConfig {
  readonly level?: string;
  readonly pretty?: boolean;
}

export interface EnvYamlConfig {
  readonly mongodb?: EnvYamlMongoConfig;
  readonly auth?: EnvYamlAuthConfig;
  readonly logging?: EnvYamlLoggingConfig;
}

export interface ResolvedEnvConfig {
  readonly mongoUri?: string;
  readonly mongoDbName: string;
  readonly capabilityTokenSecret?: string;
  readonly accountTokenSecret?: string;
  readonly apiKey?: string;
  readonly logLevel?: string;
  readonly logPretty?: boolean;
}
