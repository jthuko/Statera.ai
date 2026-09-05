# Statera Backend
See /docs for architecture. Run locally:
- `cd backend && dotnet build && dotnet run --project src/Statera.Api`

On first run the API applies EF Core migrations (or `EnsureCreated` on a brand-new DB) and seeds
dev data automatically — see `Program.cs` and `Statera.Infrastructure/Seed.cs`.

## Database

The app reads `ConnectionStrings:DefaultConnection` (falls back to `ConnectionStrings:Default`).
Pick one:

**SQL Server LocalDB** (Windows, needs admin to install) — already configured in
`appsettings.Development.json`, no extra setup.

**SQL Server in Docker** (no admin, works cross-platform):
```
docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=Your_strong_password123" -p 1433:1433 -d --name statera-sql mcr.microsoft.com/mssql/server:2022-latest
```
then point the API at it (overrides `appsettings.*`; note the double underscore):
```
set ConnectionStrings__DefaultConnection=Server=localhost,1433;Database=Statera;User Id=sa;Password=Your_strong_password123;TrustServerCertificate=True;MultipleActiveResultSets=true
```
