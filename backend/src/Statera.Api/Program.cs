using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;
using Statera.Api.Application;
using Statera.Api.Infrastructure;
using Statera.Api.Domain;

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog((ctx, lc) => lc.ReadFrom.Configuration(ctx.Configuration).Enrich.FromLogContext().WriteTo.Console());

var conn = builder.Configuration.GetConnectionString("Default") ?? "Server=localhost;Database=Statera;Trusted_Connection=False;User Id=sa;Password=Your_strong_password123;TrustServerCertificate=True";
builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlServer(conn));

builder.Services.AddIdentity<AppUser, AppRole>().AddEntityFrameworkStores<AppDbContext>().AddDefaultTokenProviders();

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("JWT"));
var jwtOpts = builder.Configuration.GetSection("JWT").Get<JwtOptions>() ?? new JwtOptions();
var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOpts.Key));
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o => {
    o.TokenValidationParameters = new() { ValidateIssuer=true, ValidateAudience=true, ValidateIssuerSigningKey=true, ValidIssuer=jwtOpts.Issuer, ValidAudience=jwtOpts.Audience, IssuerSigningKey=key };
});

builder.Services.AddAuthorization();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c => {
    c.SwaggerDoc("v1", new() { Title = "Statera API", Version = "v1" });
    var scheme = new Microsoft.OpenApi.Models.OpenApiSecurityScheme {
        Name = "Authorization", Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT", In = Microsoft.OpenApi.Models.ParameterLocation.Header, Description = "Bearer token"
    };
    c.AddSecurityDefinition("Bearer", scheme);
    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement { { scheme, new List<string>() } });
});

builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins("http://localhost:8080").AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
builder.Services.AddHealthChecks();
builder.Services.AddOpenTelemetry().ConfigureResource(r => r.AddService("statera-api")).WithTracing(t => t.AddAspNetCoreInstrumentation().AddHttpClientInstrumentation().AddOtlpExporter()).WithMetrics(m => m.AddAspNetCoreInstrumentation().AddHttpClientInstrumentation().AddOtlpExporter());

builder.Services.AddSingleton<IDateTimeProvider, SystemDateTimeProvider>();
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddScoped<IRepository, EfRepository>();
builder.Services.AddScoped<HeuristicAssignmentSuggestionService>();
builder.Services.AddScoped<LicensePolicyService>();
builder.Services.AddScoped<AssignmentValidator>();
builder.Services.AddScoped<SchedulerSuggestionService>();

builder.Services.AddControllers().AddJsonOptions(o => { o.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()); });

var app = builder.Build();
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var env = app.Services.GetRequiredService<IHostEnvironment>();
    if (env.IsDevelopment())
    {
        await db.Database.EnsureCreatedAsync();
        var logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Seed");
        await DevDataSeeder.SeedAsync(app.Services, logger, true);
    }
}
app.UseSerilogRequestLogging();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapHealthChecks("/health/live");
app.MapHealthChecks("/health/ready");
if (app.Environment.IsDevelopment()){ app.UseSwagger(); app.UseSwaggerUI(); }
app.MapControllers();
app.MapPost("/api/v1/auth/register", async (UserManager<AppUser> um, string email, string password) =>
{
    var exists = await um.FindByEmailAsync(email);
    if (exists != null) return Results.BadRequest("User exists");
    var u = new AppUser { UserName = email, Email = email, EmailConfirmed = true };
    var res = await um.CreateAsync(u, password);
    if (!res.Succeeded) return Results.BadRequest(res.Errors);
    return Results.Ok();
});
app.MapPost("/api/v1/auth/login", async (UserManager<AppUser> um, IJwtService jwt, string email, string password) =>
{
    var user = await um.FindByEmailAsync(email);
    if (user is null) return Results.Unauthorized();
    if (!await um.CheckPasswordAsync(user, password)) return Results.Unauthorized();
    var tokens = await jwt.CreateAsync(user, CancellationToken.None);
    return Results.Ok(tokens);
});
app.MapPost("/api/v1/scheduler/suggest-assignments", async (HeuristicAssignmentSuggestionService svc, ScheduleContextDto ctx, CancellationToken ct) =>
{
    var res = await svc.SuggestAsync(ctx, ct);
    return Results.Ok(res);
});
app.MapPost("/api/v1/scheduler/validate", (Assignment a) => Results.Ok(new { valid = a.EndUtc > a.StartUtc }));
app.Run();
namespace Statera.Api { public class LicensePolicyService { } public class AssignmentValidator { } public class SchedulerSuggestionService { } }
