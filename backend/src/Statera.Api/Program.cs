
using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Statera.Api.Authorization;
using Statera.Api.Endpoints;
using Statera.Api.Integrations;
using Statera.Application;
using Statera.Application.Services;
using Statera.Endpoints;
using Statera.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// JSON (DateOnly/TimeOnly are supported on .NET 8; no custom converters needed)
builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

var conn = builder.Configuration.GetConnectionString("DefaultConnection")
           ?? builder.Configuration.GetConnectionString("Default");

// Optional safety check with a friendly message
if (string.IsNullOrWhiteSpace(conn))
{
    throw new InvalidOperationException(
        "Missing SQL connection string. Add 'ConnectionStrings:DefaultConnection' (or 'Default') to appsettings.* or env vars.");
}

builder.Services.AddDbContext<AppDbContext>(opts => opts.UseSqlServer(conn));

// ASP.NET Identity (EF-backed)
builder.Services
    .AddIdentityCore<AppUser>(options =>
    {
        options.User.RequireUniqueEmail = true;
    })
    .AddRoles<AppRole>()
    .AddSignInManager()
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders();

// JWT configuration
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.Configure<IntegrationOptions>(builder.Configuration.GetSection("Integrations"));
builder.Services.Configure<StripeOptions>(builder.Configuration.GetSection("Stripe"));
builder.Services.Configure<AnthropicSettings>(builder.Configuration.GetSection("Anthropic"));
builder.Services.AddHttpClient("anthropic", c =>
{
    c.BaseAddress = new Uri("https://api.anthropic.com");
    c.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");
});

var jwtKey = builder.Configuration["Jwt:Key"]
    ?? "dev-secret-please-change-to-32-bytes-minimum";

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Keep JWT claim names as-is ("sub", "email", etc.) — prevents mapping to ClaimTypes URIs
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "statera",
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "statera-web",
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });

// Authorization policies
builder.Services.AddSingleton<Microsoft.AspNetCore.Authorization.IAuthorizationHandler, FacilityAccessHandler>();
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Authenticated", policy => policy.RequireAuthenticatedUser());
    options.AddPolicy("OwnerOnly", policy =>
        policy.RequireAuthenticatedUser().RequireClaim("system_role", "Owner"));
    options.AddPolicy("FacilityAccess", policy =>
        policy.RequireAuthenticatedUser().AddRequirements(new FacilityAccessRequirement()));
});

builder.Services.AddScoped<IRepository, EfRepository>();
builder.Services.AddScoped<LicensePolicyService>();
builder.Services.AddScoped<SchedulerSuggestionService>();
builder.Services.AddHttpClient();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(o =>
{
    o.SwaggerDoc("v1", new OpenApiInfo { Title = "Statera AI API", Version = "v1" });
    o.CustomSchemaIds(t => t.FullName);
    // Enable Bearer token auth in Swagger UI
    o.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter your JWT token (without 'Bearer ' prefix)"
    });
    o.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// Serve Swagger in all environments (root redirects to /swagger below)
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Statera AI API v1");
});

app.UseAuthentication();
app.UseAuthorization();

// Versioned API group
var v1 = app.MapGroup("/api/v1");

// Map endpoint modules
v1.MapPingEndpoints();
v1.MapHealthEndpoints();

v1.MapAuthEndpoints();            
v1.MapUsersEndpoints();           
v1.MapFacilitiesEndpoints();
v1.MapUnitsEndpoints();           
v1.MapStaffEndpoints();
v1.MapAssignmentsEndpoints();    
v1.MapSchedulesEndpoints();    
v1.MapSchedulerEndpoints();
v1.MapTemplatesEndpoints();      
v1.MapRequestsEndpoints();        
v1.MapConstraintsEndpoints();
v1.MapForecastEndpoints();
v1.MapRolesEndpoints();           
v1.MapTimeOffEndpoints();
v1.MapDemandTemplatesEndpoints();
v1.MapTimeClockEndpoints();
v1.MapChatEndpoints();
v1.MapHelpEndpoints();
v1.MapOpenShiftEndpoints();
v1.MapIntegrationsEndpoints();
v1.MapBillingEndpoints();
v1.MapBurnoutEndpoints();
v1.MapStaffingPredictionEndpoints();
v1.MapSimulationEndpoints();


// Convenience: root -> Swagger
app.MapGet("/", () => Results.Redirect("/swagger"));

// Database initialization and seeding
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    // Only use MigrateAsync when migration history already exists (i.e. production).
    // When history is empty (EnsureCreated was used, or dev wipe just happened)
    // the seeder will re-create via EnsureCreated, which picks up the current model.
    var appliedMigrations = await db.Database.GetAppliedMigrationsAsync();
    if (appliedMigrations.Any())
    {
        await db.Database.MigrateAsync();
    }

    await DevDataSeeder.ResetAndSeedAsync(
        scope.ServiceProvider,
        logger,
        app.Environment.IsDevelopment(),
        resetDatabase: false  // Never wipe data — preserves accounts across restarts
    );

    // ── Schema drift fix ──────────────────────────────────────────────────────
    // EnsureCreatedAsync doesn't add new columns to existing tables. This block
    // safely adds columns that were introduced after the initial DB creation,
    // so deployments don't fail when the model has evolved.
    try
    {
        await db.Database.ExecuteSqlRawAsync(@"
            -- Facilities: plan / trial columns
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Facilities') AND name = 'PlanStatus')
                ALTER TABLE Facilities ADD PlanStatus nvarchar(20) NOT NULL DEFAULT 'Trial';
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Facilities') AND name = 'PlanTier')
                ALTER TABLE Facilities ADD PlanTier nvarchar(20) NOT NULL DEFAULT 'Growth';
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Facilities') AND name = 'TrialStartUtc')
                ALTER TABLE Facilities ADD TrialStartUtc datetime2 NULL;
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Facilities') AND name = 'TrialEndsUtc')
                ALTER TABLE Facilities ADD TrialEndsUtc datetime2 NULL;
            -- Facilities: Stripe billing columns
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Facilities') AND name = 'StripeCustomerId')
                ALTER TABLE Facilities ADD StripeCustomerId nvarchar(MAX) NULL;
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Facilities') AND name = 'StripeSubscriptionId')
                ALTER TABLE Facilities ADD StripeSubscriptionId nvarchar(MAX) NULL;
            -- Facilities: branding columns
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Facilities') AND name = 'LogoUrl')
                ALTER TABLE Facilities ADD LogoUrl nvarchar(MAX) NULL;
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Facilities') AND name = 'PrimaryColor')
                ALTER TABLE Facilities ADD PrimaryColor nvarchar(MAX) NULL;
            -- Units: extended metadata columns
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Units') AND name = 'Type')
                ALTER TABLE Units ADD Type nvarchar(MAX) NULL;
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Units') AND name = 'Floor')
                ALTER TABLE Units ADD Floor nvarchar(MAX) NULL;
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Units') AND name = 'Capacity')
                ALTER TABLE Units ADD Capacity int NULL;
            -- Staff: demographics / payroll integration columns
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'Phone')
                ALTER TABLE Staff ADD Phone nvarchar(MAX) NULL;
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'Address1')
                ALTER TABLE Staff ADD Address1 nvarchar(MAX) NULL;
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'Address2')
                ALTER TABLE Staff ADD Address2 nvarchar(MAX) NULL;
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'City')
                ALTER TABLE Staff ADD City nvarchar(MAX) NULL;
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'State')
                ALTER TABLE Staff ADD State nvarchar(MAX) NULL;
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'Zip')
                ALTER TABLE Staff ADD Zip nvarchar(MAX) NULL;
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'DateOfBirth')
                ALTER TABLE Staff ADD DateOfBirth date NULL;
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'EmergencyContactName')
                ALTER TABLE Staff ADD EmergencyContactName nvarchar(MAX) NULL;
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'EmergencyContactPhone')
                ALTER TABLE Staff ADD EmergencyContactPhone nvarchar(MAX) NULL;
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'PhotoUrl')
                ALTER TABLE Staff ADD PhotoUrl nvarchar(MAX) NULL;
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'GustoEmployeeId')
                ALTER TABLE Staff ADD GustoEmployeeId nvarchar(MAX) NULL;
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'QuickBooksEmployeeId')
                ALTER TABLE Staff ADD QuickBooksEmployeeId nvarchar(MAX) NULL;
        ");
        logger.LogInformation("Schema drift check complete.");
    }
    catch (Exception schemaEx)
    {
        logger.LogWarning("Schema drift fix skipped (DB may not be initialized yet): {Msg}", schemaEx.Message);
    }
}

app.Run();

public partial class Program { }
