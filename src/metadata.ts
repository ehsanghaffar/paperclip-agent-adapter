export const DEFAULT_BASE_URL = "";

export const type = "custom_llm";
export const label = "custom LLM";
export const models = [];

export const agentConfigurationDoc = `# custom agent configuration

# Custom LLM adapter
 
this adapter allows you to connect to a custom LLM endpoint. It is compatible with the OpenAI API and Anthropic API, 
but can also be used with any other LLM endpoint that follows the same request/response format.


## configuration
- *apiKeyEnv*: The name of the environment variable that contains your API key. For example, "MY_API_KEY". This is used to authenticate requests to your custom LLM endpoint.
- *model*: The model ID to use for the request. For example, "gpt-4" or "claude-v1".
- *baseUrl*: The base URL of your custom LLM endpoint. For example, "https://api.example.com/v1".
- *requestTimeoutMs*: The request timeout in milliseconds. For example, 30000 for 30 seconds.


### Security
Never put raw API keys in adapterConfig. Use \`apiKeyEnv\` to reference a server environment variable.
`;
