
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
        resetDatabase: app.Environment.IsDevelopment()
    );
}

app.Run();

public partial class Program { }
