using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace Statera.Infrastructure
{
    /// <summary>
    /// Ensures EF Tools always have a connection string at design-time (dotnet ef ...).
    /// Priority:
    /// 1) env var ConnectionStrings__Default
    /// 2) statera/backend/src/Statera.Api/appsettings.Development.json
    /// 3) fallback to (localdb)\MSSQLLocalDB
    /// </summary>
    public class DesignTimeFactory : IDesignTimeDbContextFactory<AppDbContext>
    {
        public AppDbContext CreateDbContext(string[] args)
        {
            // 1) Env var first (works well in CI or local shells)
            var fromEnv = Environment.GetEnvironmentVariable("ConnectionStrings__Default");
            if (!string.IsNullOrWhiteSpace(fromEnv))
                return Build(fromEnv);

            // 2) Try to load the API's Development settings so we reuse your local config
            // Current dir during 'dotnet ef' is typically the Infrastructure project folder.
            // Walk to the API folder and read appsettings.Development.json if present.
            var apiDir = Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "..", "Statera.Api"));
            var cfg = new ConfigurationBuilder()
                .SetBasePath(apiDir)
                .AddJsonFile("appsettings.json", optional: true)
                .AddJsonFile("appsettings.Development.json", optional: true)
                .AddEnvironmentVariables()
                .Build();

            var cs = cfg.GetConnectionString("Default");
            if (!string.IsNullOrWhiteSpace(cs))
                return Build(cs);

            // 3) Final fallback so EF Tools never fail on dev machines
            cs = @"Server=(localdb)\MSSQLLocalDB;Database=Statera;Trusted_Connection=True;TrustServerCertificate=True";
            return Build(cs);
        }

        private static AppDbContext Build(string connectionString)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlServer(connectionString)
                .Options;

            return new AppDbContext(options);
        }
    }
}
