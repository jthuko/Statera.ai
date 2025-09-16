using System.Collections.Generic;
namespace Statera.Api.Contracts;

public record SetFeatureFlagsRequest(Dictionary<string, bool> Flags);
public record SeedDemoDataRequest(int StaffCount, int Weeks);
