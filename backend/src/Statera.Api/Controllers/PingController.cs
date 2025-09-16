using Microsoft.AspNetCore.Mvc;

namespace Statera.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PingController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new { message = "pong", at = DateTime.UtcNow });
}

