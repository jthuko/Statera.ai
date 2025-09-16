// backend/src/Statera.Api/Program.cs
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using Statera.Api.Endpoints;
using Statera.Application;
using Statera.Application.Services;
using Statera.Endpoints;
using Statera.Infrastructure;   // AppDbContext, AppUser, AppRole
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// JSON (DateOnly/TimeOnly are supported on .NET 8; no custom converters needed)
builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

// EF Core (use your connection string "DefaultConnection" from appsettings.*)
// 🔧 Read the connection string once, with a fallback between common keys
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
        // tweak password/lockout options here if desired
    })
    .AddRoles<AppRole>()
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders();

builder.Services.AddAuthentication();
builder.Services.AddAuthorization();

builder.Services.AddScoped<IRepository, EfRepository>();
builder.Services.AddScoped<LicensePolicyService>();
builder.Services.AddScoped<SchedulerSuggestionService>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(o =>
{
    o.SwaggerDoc("v1", new OpenApiInfo { Title = "Statera AI API", Version = "v1" });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

// Versioned API group
var v1 = app.MapGroup("/api/v1");

// Map endpoint modules
v1.MapPingEndpoints();
v1.MapHealthEndpoints();

v1.MapAuthEndpoints();            // your auth module (if implemented)
v1.MapUsersEndpoints();           // Identity-backed users
v1.MapFacilitiesEndpoints();
v1.MapUnitsEndpoints();           // <-- replaces Departments
v1.MapStaffEndpoints();
v1.MapAssignmentsEndpoints();     // <-- replaces Shifts
v1.MapSchedulesEndpoints();       // (uses UnitId)
v1.MapTemplatesEndpoints();       // Shift templates (TimeSpan times)
v1.MapRequestsEndpoints();        // Time-off / requests
v1.MapConstraintsEndpoints();
v1.MapForecastEndpoints();

// Convenience: root -> Swagger
app.MapGet("/", () => Results.Redirect("/swagger"));

// Apply pending migrations on startup (dev-friendly; remove if you want manual control)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}

app.Run();

public partial class Program { }
