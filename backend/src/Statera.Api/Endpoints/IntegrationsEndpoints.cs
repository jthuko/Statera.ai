using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Statera.Domain;
using Statera.Api.Integrations;
using Statera.Infrastructure;

namespace Statera.Api.Endpoints;

public static class IntegrationsEndpoints
{
    public static RouteGroupBuilder MapIntegrationsEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("").WithTags("Integrations");

        // GET /api/v1/facilities/{facilityId}/integrations
        g.MapGet("/facilities/{facilityId:guid}/integrations", async (
            Guid facilityId,
            [FromServices] AppDbContext db) =>
        {
            var rows = await db.FacilityIntegrations
                .AsNoTracking()
                .Where(x => x.FacilityId == facilityId)
                .ToListAsync();

            var result = new[]
            {
                MapStatus(rows, "Gusto"),
                MapStatus(rows, "QuickBooks")
            };

            return Results.Ok(result);
        })
        .RequireAuthorization("FacilityAccess");

        // POST /api/v1/facilities/{facilityId}/integrations/{provider}/connect
        g.MapPost("/facilities/{facilityId:guid}/integrations/{provider}/connect", (
            Guid facilityId,
            string provider,
            HttpContext ctx,
            [FromServices] IOptions<IntegrationOptions> opt) =>
        {
            if (!TryGetProvider(provider, opt.Value, out var normalizedProvider, out var providerOptions, out var error))
                return Results.BadRequest(new { error });

            if (string.IsNullOrWhiteSpace(providerOptions.AuthorizationEndpoint))
                return Results.BadRequest(new { error = "Integration is not configured." });

            var state = CreateState(new IntegrationState(facilityId, normalizedProvider, Guid.NewGuid().ToString("N")), opt.Value.StateSigningKey);
            var authUrl = BuildAuthUrl(providerOptions, state);

            return Results.Ok(new { authUrl });
        })
        .RequireAuthorization("FacilityAccess");

        // POST /api/v1/facilities/{facilityId}/integrations/{provider}/disconnect
        g.MapPost("/facilities/{facilityId:guid}/integrations/{provider}/disconnect", async (
            Guid facilityId,
            string provider,
            [FromServices] AppDbContext db) =>
        {
            var normalized = NormalizeProvider(provider);
            if (normalized is null) return Results.BadRequest(new { error = "Unknown provider" });

            var existing = await db.FacilityIntegrations
                .FirstOrDefaultAsync(x => x.FacilityId == facilityId && x.Provider == normalized);

            if (existing is null) return Results.NoContent();

            db.FacilityIntegrations.Remove(existing);
            await db.SaveChangesAsync();
            return Results.Ok(new { ok = true });
        })
        .RequireAuthorization("FacilityAccess");

        // POST /api/v1/facilities/{facilityId}/integrations/{provider}/export-timesheets
        g.MapPost("/facilities/{facilityId:guid}/integrations/{provider}/export-timesheets", async (
            Guid facilityId,
            string provider,
            [FromBody] ExportTimesheetsRequest req,
            [FromServices] IHttpClientFactory httpFactory,
            [FromServices] IOptions<IntegrationOptions> opt,
            [FromServices] AppDbContext db) =>
        {
            if (!TryGetProvider(provider, opt.Value, out var normalizedProvider, out var providerOptions, out var providerError))
                return Results.BadRequest(new { error = providerError });

            var integration = await db.FacilityIntegrations
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.FacilityId == facilityId && x.Provider == normalizedProvider);

            if (integration is null)
                return Results.BadRequest(new { error = "Integration not connected" });

            if (string.IsNullOrWhiteSpace(providerOptions.ApiBaseUrl) || string.IsNullOrWhiteSpace(providerOptions.TimeEntryEndpoint))
                return Results.BadRequest(new { error = "Integration API not configured" });

            if (req.FromUtc is null || req.ToUtc is null)
                return Results.BadRequest(new { error = "FromUtc and ToUtc are required" });

            var fromUtc = req.FromUtc.Value;
            var toUtc = req.ToUtc.Value;

            var entriesQuery = db.TimeClockEntries.AsNoTracking()
                .Where(e => e.FacilityId == facilityId)
                .Where(e => e.ClockInUtc >= fromUtc && e.ClockInUtc <= toUtc)
                .Where(e => e.ClockOutUtc != null);

            if (req.StaffId.HasValue)
                entriesQuery = entriesQuery.Where(e => e.StaffId == req.StaffId.Value);

            if (!string.IsNullOrWhiteSpace(req.Status))
                entriesQuery = entriesQuery.Where(e => e.Status == req.Status);

            var entries = await entriesQuery.ToListAsync();
            if (entries.Count == 0)
                return Results.Ok(new { exported = 0, skipped = 0, errors = Array.Empty<object>() });

            var staffIds = entries.Select(e => e.StaffId).Distinct().ToList();
            var staff = await db.Staff.AsNoTracking().Where(s => staffIds.Contains(s.Id)).ToListAsync();
            var staffMap = staff.ToDictionary(s => s.Id, s => s);

            if (string.IsNullOrWhiteSpace(integration.ExternalCompanyId))
                return Results.BadRequest(new { error = "Integration missing company ID" });

            var apiUrl = BuildApiUrl(providerOptions, integration.ExternalCompanyId);
            var client = httpFactory.CreateClient();
            client.BaseAddress = new Uri(providerOptions.ApiBaseUrl.TrimEnd('/'));
            client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", integration.AccessToken);

            var exported = 0;
            var skipped = 0;
            var errors = new List<object>();

            foreach (var entry in entries)
            {
                if (!staffMap.TryGetValue(entry.StaffId, out var s))
                {
                    skipped++; errors.Add(new { entryId = entry.Id, error = "Staff not found" });
                    continue;
                }

                var employeeId = normalizedProvider == "Gusto" ? s.GustoEmployeeId : s.QuickBooksEmployeeId;
                if (string.IsNullOrWhiteSpace(employeeId))
                {
                    skipped++; errors.Add(new { entryId = entry.Id, error = "Missing employee ID for provider" });
                    continue;
                }

                var hours = (entry.ClockOutUtc.HasValue)
                    ? (entry.ClockOutUtc.Value - entry.ClockInUtc).TotalHours
                    : 0;
                var lunchMinutes = (entry.LunchOutUtc.HasValue && entry.LunchInUtc.HasValue)
                    ? (entry.LunchInUtc.Value - entry.LunchOutUtc.Value).TotalMinutes
                    : 0;
                var netHours = Math.Max(0, hours - (lunchMinutes / 60.0));

                var payload = normalizedProvider == "Gusto"
                    ? BuildGustoPayload(entry, employeeId!, netHours)
                    : BuildQuickBooksPayload(entry, employeeId!, netHours);

                if (req.DryRun)
                {
                    exported++;
                    continue;
                }

                using var resp = await client.PostAsJsonAsync(apiUrl, payload);
                var body = await resp.Content.ReadAsStringAsync();
                if (!resp.IsSuccessStatusCode)
                {
                    skipped++;
                    errors.Add(new { entryId = entry.Id, error = "Provider export failed", detail = body });
                    continue;
                }

                exported++;
            }

            return Results.Ok(new { exported, skipped, errors });
        })
        .RequireAuthorization("FacilityAccess");

        // GET /api/v1/integrations/{provider}/callback
        g.MapGet("/integrations/{provider}/callback", async (
            string provider,
            [FromQuery] string? code,
            [FromQuery] string? state,
            [FromQuery] string? realmId,
            [FromQuery] string? error,
            [FromQuery] string? error_description,
            [FromServices] IHttpClientFactory httpFactory,
            [FromServices] IOptions<IntegrationOptions> opt,
            [FromServices] AppDbContext db) =>
        {
            if (!string.IsNullOrWhiteSpace(error))
                return Results.BadRequest(new { error = error_description ?? error });

            if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(state))
                return Results.BadRequest(new { error = "Missing code or state" });

            if (!TryValidateState(state, opt.Value.StateSigningKey, out var parsedState))
                return Results.BadRequest(new { error = "Invalid state" });

            if (!TryGetProvider(provider, opt.Value, out var normalizedProvider, out var providerOptions, out var providerError))
                return Results.BadRequest(new { error = providerError });

            if (!string.Equals(parsedState.Provider, normalizedProvider, StringComparison.OrdinalIgnoreCase))
                return Results.BadRequest(new { error = "Provider mismatch" });

            var client = httpFactory.CreateClient();
            var form = new Dictionary<string, string>
            {
                ["grant_type"] = "authorization_code",
                ["code"] = code,
                ["redirect_uri"] = providerOptions.RedirectUri
            };

            if (providerOptions.TokenAuthMethod.Equals("body", StringComparison.OrdinalIgnoreCase))
            {
                form["client_id"] = providerOptions.ClientId;
                form["client_secret"] = providerOptions.ClientSecret;
            }

            using var req = new HttpRequestMessage(HttpMethod.Post, providerOptions.TokenEndpoint)
            {
                Content = new FormUrlEncodedContent(form)
            };

            if (providerOptions.TokenAuthMethod.Equals("basic", StringComparison.OrdinalIgnoreCase))
            {
                var basic = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{providerOptions.ClientId}:{providerOptions.ClientSecret}"));
                req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", basic);
            }

            var resp = await client.SendAsync(req);
            var payload = await resp.Content.ReadAsStringAsync();
            if (!resp.IsSuccessStatusCode)
                return Results.BadRequest(new { error = "Token exchange failed", detail = payload });

            using var doc = JsonDocument.Parse(payload);
            var root = doc.RootElement;
            var accessToken = root.GetProperty("access_token").GetString();
            var refreshToken = root.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : null;
            var expiresIn = root.TryGetProperty("expires_in", out var exp) ? exp.GetInt32() : (int?)null;

            if (string.IsNullOrWhiteSpace(accessToken))
                return Results.BadRequest(new { error = "No access token returned" });

            var now = DateTime.UtcNow;
            var existing = await db.FacilityIntegrations
                .FirstOrDefaultAsync(x => x.FacilityId == parsedState.FacilityId && x.Provider == normalizedProvider);

            if (existing is null)
            {
                existing = new FacilityIntegration
                {
                    Id = Guid.NewGuid(),
                    FacilityId = parsedState.FacilityId,
                    Provider = normalizedProvider,
                    CreatedUtc = now
                };
                db.FacilityIntegrations.Add(existing);
            }

            existing.AccessToken = accessToken;
            existing.RefreshToken = refreshToken;
            existing.ExpiresUtc = expiresIn.HasValue ? now.AddSeconds(expiresIn.Value) : null;
            existing.ExternalCompanyId = !string.IsNullOrWhiteSpace(realmId) ? realmId : existing.ExternalCompanyId;
            existing.UpdatedUtc = now;

            await db.SaveChangesAsync();

            var redirect = $"{opt.Value.FrontendBaseUrl.TrimEnd('/')}/facilities/{parsedState.FacilityId}?tab=integrations";
            return Results.Redirect(redirect);
        });

        return v1;
    }

    private static object MapStatus(List<FacilityIntegration> rows, string provider)
    {
        var match = rows.FirstOrDefault(r => r.Provider == provider);
        return new
        {
            provider,
            connected = match is not null,
            updatedUtc = match?.UpdatedUtc,
            externalCompanyId = match?.ExternalCompanyId
        };
    }

    private static bool TryGetProvider(string provider,
        IntegrationOptions options,
        out string normalized,
        out OAuthProviderOptions providerOptions,
        out string? error)
    {
        normalized = NormalizeProvider(provider) ?? "";
        providerOptions = new OAuthProviderOptions();
        error = null;

        if (normalized == "Gusto")
        {
            providerOptions = options.Gusto;
            return true;
        }
        if (normalized == "QuickBooks")
        {
            providerOptions = options.QuickBooks;
            return true;
        }

        error = "Unknown provider";
        return false;
    }

    private static string? NormalizeProvider(string provider)
    {
        var p = provider.Trim().ToLowerInvariant();
        if (p is "gusto") return "Gusto";
        if (p is "quickbooks" or "quick-books" or "qb") return "QuickBooks";
        return null;
    }

    private record IntegrationState(Guid FacilityId, string Provider, string Nonce);

    private static string CreateState(IntegrationState state, string key)
    {
        var json = JsonSerializer.Serialize(state);
        var payload = Base64UrlEncode(Encoding.UTF8.GetBytes(json));
        var signature = Base64UrlEncode(Sign(payload, key));
        return $"{payload}.{signature}";
    }

    private static bool TryValidateState(string state, string key, out IntegrationState parsed)
    {
        parsed = new IntegrationState(Guid.Empty, string.Empty, string.Empty);
        var parts = state.Split('.');
        if (parts.Length != 2) return false;
        var payload = parts[0];
        var signature = parts[1];

        var expected = Base64UrlEncode(Sign(payload, key));
        if (!CryptographicEquals(signature, expected)) return false;

        var json = Encoding.UTF8.GetString(Base64UrlDecode(payload));
        var obj = JsonSerializer.Deserialize<IntegrationState>(json);
        if (obj is null || obj.FacilityId == Guid.Empty) return false;

        parsed = obj;
        return true;
    }

    private static byte[] Sign(string payload, string key)
    {
        var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(key));
        return hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
    }

    private static bool CryptographicEquals(string a, string b)
    {
        if (a.Length != b.Length) return false;
        var diff = 0;
        for (var i = 0; i < a.Length; i++) diff |= a[i] ^ b[i];
        return diff == 0;
    }

    private static string BuildAuthUrl(OAuthProviderOptions options, string state)
    {
        var qp = new Dictionary<string, string>
        {
            ["response_type"] = "code",
            ["client_id"] = options.ClientId,
            ["redirect_uri"] = options.RedirectUri,
            ["scope"] = options.Scopes,
            ["state"] = state
        };

        foreach (var kv in options.ExtraAuthParams)
        {
            qp[kv.Key] = kv.Value;
        }

        var query = string.Join("&", qp
            .Where(kv => !string.IsNullOrWhiteSpace(kv.Value))
            .Select(kv => $"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value)}"));

        var sep = options.AuthorizationEndpoint.Contains("?") ? "&" : "?";
        return options.AuthorizationEndpoint + sep + query;
    }

    private static string BuildApiUrl(OAuthProviderOptions options, string companyId)
    {
        var path = options.TimeEntryEndpoint.Replace("{companyId}", companyId);
        if (!path.StartsWith("/")) path = "/" + path;
        return path;
    }

    private static object BuildGustoPayload(TimeClockEntry entry, string employeeId, double netHours)
    {
        return new
        {
            employee_id = employeeId,
            date = entry.ClockInUtc.ToString("yyyy-MM-dd"),
            start_time = entry.ClockInUtc,
            end_time = entry.ClockOutUtc,
            hours = Math.Round(netHours, 2),
            notes = entry.Notes
        };
    }

    private static object BuildQuickBooksPayload(TimeClockEntry entry, string employeeId, double netHours)
    {
        var totalMinutes = (int)Math.Round(netHours * 60.0);
        var hours = totalMinutes / 60;
        var minutes = totalMinutes % 60;

        return new
        {
            NameOf = "Employee",
            TxnDate = entry.ClockInUtc.ToString("yyyy-MM-dd"),
            EmployeeRef = new { value = employeeId },
            Hours = hours,
            Minutes = minutes,
            StartTime = entry.ClockInUtc,
            EndTime = entry.ClockOutUtc,
            BillableStatus = "NotBillable"
        };
    }

    private record ExportTimesheetsRequest(DateTime? FromUtc, DateTime? ToUtc, Guid? StaffId, string? Status, bool DryRun = false);

    private static string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static byte[] Base64UrlDecode(string input)
    {
        var padded = input.Replace('-', '+').Replace('_', '/');
        switch (padded.Length % 4)
        {
            case 2: padded += "=="; break;
            case 3: padded += "="; break;
        }
        return Convert.FromBase64String(padded);
    }
}
