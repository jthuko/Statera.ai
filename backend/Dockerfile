FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet restore Statera.sln
RUN dotnet build Statera.sln -c Release --no-restore
RUN dotnet publish src/Statera.Api/Statera.Api.csproj -c Release -o /app/publish --no-build

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
EXPOSE 5199
ENV ASPNETCORE_URLS=http://+:5199
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet","Statera.Api.dll"]
