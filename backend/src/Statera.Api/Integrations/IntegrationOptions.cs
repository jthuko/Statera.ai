namespace Statera.Api.Integrations;

public class IntegrationOptions
{
    public string FrontendBaseUrl { get; set; } = "http://localhost:8080";
    public string StateSigningKey { get; set; } = "dev-integrations-state-key";
    public OAuthProviderOptions Gusto { get; set; } = new();
    public OAuthProviderOptions QuickBooks { get; set; } = new();
}

public class OAuthProviderOptions
{
    public string AuthorizationEndpoint { get; set; } = "";
    public string TokenEndpoint { get; set; } = "";
    public string ApiBaseUrl { get; set; } = "";
    public string TimeEntryEndpoint { get; set; } = ""; // supports {companyId}
    public string ClientId { get; set; } = "";
    public string ClientSecret { get; set; } = "";
    public string RedirectUri { get; set; } = "";
    public string Scopes { get; set; } = ""; // space-delimited
    public string TokenAuthMethod { get; set; } = "basic"; // basic | body
    public Dictionary<string, string> ExtraAuthParams { get; set; } = new();
}
