using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Statera.Domain;
using Statera.Infrastructure;
using System.IdentityModel.Tokens.Jwt;

namespace Statera.Api.Endpoints;

public static class HiringEndpoints
{
    static readonly string[] DefaultChecklistItems =
        ["ANE Check", "Background Check", "OIG Check", "Drug Test", "W-4", "K-4", "I-9"];

    public static RouteGroupBuilder MapHiringEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/hiring").WithTags("Hiring").RequireAuthorization();

        // ── Checklist Templates ────────────────────────────────────────────────

        // GET /api/v1/hiring/templates?facilityId=
        g.MapGet("/templates", async (
            [FromQuery] Guid facilityId,
            [FromServices] AppDbContext db) =>
        {
            var items = await db.HiringChecklistTemplates
                .Where(t => t.FacilityId == facilityId)
                .OrderBy(t => t.SortOrder).ThenBy(t => t.Name)
                .Select(t => new { t.Id, t.Name, t.IsDefault, t.SortOrder })
                .ToListAsync();

            // If no templates exist for this facility, return hard-coded defaults (don't save yet)
            if (!items.Any())
                return Results.Ok(DefaultChecklistItems.Select((n, i) => new { Id = (Guid?)null, Name = n, IsDefault = true, SortOrder = i + 1 }));

            return Results.Ok(items);
        });

        // POST /api/v1/hiring/templates
        g.MapPost("/templates", async (
            [FromBody] AddTemplateRequest req,
            [FromServices] AppDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(req.Name))
                return Results.BadRequest(new { error = "Name is required" });

            // Ensure defaults exist first (so custom items are after them)
            await EnsureDefaultTemplates(db, req.FacilityId);

            var maxOrder = await db.HiringChecklistTemplates
                .Where(t => t.FacilityId == req.FacilityId)
                .MaxAsync(t => (int?)t.SortOrder) ?? 0;

            var item = new HiringChecklistTemplate
            {
                Id = Guid.NewGuid(),
                FacilityId = req.FacilityId,
                Name = req.Name.Trim(),
                IsDefault = false,
                SortOrder = maxOrder + 1
            };
            db.HiringChecklistTemplates.Add(item);
            await db.SaveChangesAsync();
            return Results.Ok(new { item.Id, item.Name, item.IsDefault, item.SortOrder });
        });

        // DELETE /api/v1/hiring/templates/{id}
        g.MapDelete("/templates/{id:guid}", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var item = await db.HiringChecklistTemplates.FindAsync(id);
            if (item is null) return Results.NotFound();
            db.HiringChecklistTemplates.Remove(item);
            await db.SaveChangesAsync();
            return Results.Ok(new { ok = true });
        });

        // ── Candidates CRUD ────────────────────────────────────────────────────

        // GET /api/v1/hiring/candidates?facilityId=&status=&from=&to=
        g.MapGet("/candidates", async (
            [FromQuery] Guid facilityId,
            [FromQuery] string? status,
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to,
            [FromServices] AppDbContext db) =>
        {
            var q = db.HiringCandidates
                .Include(c => c.ChecklistItems)
                .Include(c => c.Documents)
                .Where(c => c.FacilityId == facilityId)
                .AsNoTracking();

            if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<CandidateStatus>(status, out var s))
                q = q.Where(c => c.Status == s);

            if (from.HasValue) q = q.Where(c => c.AppliedUtc >= from.Value);
            if (to.HasValue)   q = q.Where(c => c.AppliedUtc <= to.Value);

            var list = await q.OrderByDescending(c => c.AppliedUtc).ToListAsync();

            return Results.Ok(list.Select(c => ToCandidateDto(c)));
        });

        // POST /api/v1/hiring/candidates
        g.MapPost("/candidates", async (
            HttpContext ctx,
            [FromBody] CreateCandidateRequest req,
            [FromServices] AppDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(req.FirstName) || string.IsNullOrWhiteSpace(req.LastName))
                return Results.BadRequest(new { error = "FirstName and LastName are required" });

            // Load or create default checklist items for this facility
            var templates = await db.HiringChecklistTemplates
                .Where(t => t.FacilityId == req.FacilityId)
                .OrderBy(t => t.SortOrder)
                .ToListAsync();

            // If no templates, seed defaults into DB now
            if (!templates.Any())
            {
                templates = await EnsureDefaultTemplates(db, req.FacilityId);
            }

            var candidate = new HiringCandidate
            {
                Id = Guid.NewGuid(),
                FacilityId = req.FacilityId,
                FirstName = req.FirstName.Trim(),
                LastName = req.LastName.Trim(),
                Email = req.Email?.Trim(),
                Phone = req.Phone?.Trim(),
                Position = req.Position?.Trim(),
                Status = CandidateStatus.Applied,
                AppliedUtc = DateTime.UtcNow,
                Notes = req.Notes?.Trim(),
                ChecklistItems = templates.Select((t, i) => new CandidateChecklistItem
                {
                    Id = Guid.NewGuid(),
                    Name = t.Name,
                    IsChecked = false
                }).ToList()
            };
            db.HiringCandidates.Add(candidate);
            await db.SaveChangesAsync();

            await db.Entry(candidate).Collection(c => c.ChecklistItems).LoadAsync();
            await db.Entry(candidate).Collection(c => c.Documents).LoadAsync();
            return Results.Ok(ToCandidateDto(candidate));
        });

        // GET /api/v1/hiring/candidates/{id}
        g.MapGet("/candidates/{id:guid}", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var c = await db.HiringCandidates
                .Include(x => x.ChecklistItems)
                .Include(x => x.Documents)
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == id);
            if (c is null) return Results.NotFound();
            return Results.Ok(ToCandidateDto(c));
        });

        // PUT /api/v1/hiring/candidates/{id}
        g.MapPut("/candidates/{id:guid}", async (
            Guid id,
            [FromBody] UpdateCandidateRequest req,
            [FromServices] AppDbContext db) =>
        {
            var c = await db.HiringCandidates.FindAsync(id);
            if (c is null) return Results.NotFound();

            if (!string.IsNullOrWhiteSpace(req.FirstName)) c.FirstName = req.FirstName.Trim();
            if (!string.IsNullOrWhiteSpace(req.LastName)) c.LastName = req.LastName.Trim();
            c.Email    = req.Email?.Trim();
            c.Phone    = req.Phone?.Trim();
            c.Position = req.Position?.Trim();
            c.Notes    = req.Notes?.Trim();
            if (req.Status.HasValue) c.Status = req.Status.Value;

            await db.SaveChangesAsync();
            return Results.Ok(new { ok = true });
        });

        // DELETE /api/v1/hiring/candidates/{id}
        g.MapDelete("/candidates/{id:guid}", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var c = await db.HiringCandidates.FindAsync(id);
            if (c is null) return Results.NotFound();
            db.HiringCandidates.Remove(c);
            await db.SaveChangesAsync();
            return Results.Ok(new { ok = true });
        });

        // ── Candidate Status Transitions ───────────────────────────────────────

        // POST /api/v1/hiring/candidates/{id}/onboard
        g.MapPost("/candidates/{id:guid}/onboard", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var c = await db.HiringCandidates
                .Include(x => x.ChecklistItems)
                .FirstOrDefaultAsync(x => x.Id == id);
            if (c is null) return Results.NotFound();
            if (c.Status == CandidateStatus.Hired)
                return Results.BadRequest(new { error = "Candidate is already hired." });

            c.Status = CandidateStatus.Onboarding;
            c.OnboardingStartedUtc = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return Results.Ok(new { ok = true });
        });

        // POST /api/v1/hiring/candidates/{id}/hire
        g.MapPost("/candidates/{id:guid}/hire", async (
            Guid id,
            [FromServices] AppDbContext db) =>
        {
            var c = await db.HiringCandidates
                .Include(x => x.ChecklistItems)
                .Include(x => x.Documents)
                .FirstOrDefaultAsync(x => x.Id == id);
            if (c is null) return Results.NotFound();
            if (c.Status == CandidateStatus.Hired)
                return Results.BadRequest(new { error = "Candidate is already hired." });

            // Create Staff record
            var staff = new Statera.Domain.Staff
            {
                Id             = Guid.NewGuid(),
                FacilityId     = c.FacilityId,
                FirstName      = c.FirstName,
                LastName       = c.LastName,
                Email          = c.Email,
                Phone          = c.Phone,
                Role           = c.Position ?? "Staff",
                EmploymentType = EmploymentType.FullTime,
                Active         = true,
            };
            db.Staff.Add(staff);

            c.Status        = CandidateStatus.Hired;
            c.HiredUtc      = DateTime.UtcNow;
            c.LinkedStaffId = staff.Id;

            await db.SaveChangesAsync();
            return Results.Ok(new { ok = true, staffId = staff.Id });
        });

        // POST /api/v1/hiring/candidates/{id}/reject
        g.MapPost("/candidates/{id:guid}/reject", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var c = await db.HiringCandidates.FindAsync(id);
            if (c is null) return Results.NotFound();
            c.Status = CandidateStatus.Rejected;
            await db.SaveChangesAsync();
            return Results.Ok(new { ok = true });
        });

        // ── Checklist Items ────────────────────────────────────────────────────

        // PUT /api/v1/hiring/candidates/{id}/checklist/{itemId}
        g.MapPut("/candidates/{id:guid}/checklist/{itemId:guid}", async (
            Guid id, Guid itemId,
            [FromBody] ToggleChecklistRequest req,
            [FromServices] AppDbContext db) =>
        {
            var item = await db.CandidateChecklistItems
                .FirstOrDefaultAsync(x => x.Id == itemId && x.CandidateId == id);
            if (item is null) return Results.NotFound();
            item.IsChecked  = req.IsChecked;
            item.CheckedUtc = req.IsChecked ? DateTime.UtcNow : null;
            await db.SaveChangesAsync();
            return Results.Ok(new { ok = true });
        });

        // POST /api/v1/hiring/candidates/{id}/checklist  (add custom item)
        g.MapPost("/candidates/{id:guid}/checklist", async (
            Guid id,
            [FromBody] AddChecklistItemRequest req,
            [FromServices] AppDbContext db) =>
        {
            if (!await db.HiringCandidates.AnyAsync(x => x.Id == id))
                return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Name))
                return Results.BadRequest(new { error = "Name is required" });

            var item = new CandidateChecklistItem
            {
                Id = Guid.NewGuid(),
                CandidateId = id,
                Name = req.Name.Trim(),
                IsChecked = false
            };
            db.CandidateChecklistItems.Add(item);
            await db.SaveChangesAsync();
            return Results.Ok(new { item.Id, item.Name, item.IsChecked, item.CheckedUtc });
        });

        // DELETE /api/v1/hiring/candidates/{id}/checklist/{itemId}
        g.MapDelete("/candidates/{id:guid}/checklist/{itemId:guid}", async (
            Guid id, Guid itemId, [FromServices] AppDbContext db) =>
        {
            var item = await db.CandidateChecklistItems
                .FirstOrDefaultAsync(x => x.Id == itemId && x.CandidateId == id);
            if (item is null) return Results.NotFound();
            db.CandidateChecklistItems.Remove(item);
            await db.SaveChangesAsync();
            return Results.Ok(new { ok = true });
        });

        // ── Candidate Documents ────────────────────────────────────────────────

        // POST /api/v1/hiring/candidates/{id}/documents  (multipart upload)
        g.MapPost("/candidates/{id:guid}/documents", async (
            Guid id,
            HttpContext ctx,
            [FromServices] AppDbContext db) =>
        {
            if (!await db.HiringCandidates.AnyAsync(x => x.Id == id))
                return Results.NotFound();

            var file = ctx.Request.Form.Files.FirstOrDefault();
            if (file is null || file.Length == 0)
                return Results.BadRequest(new { error = "No file provided" });
            if (file.Length > 20 * 1024 * 1024)
                return Results.BadRequest(new { error = "File exceeds 20 MB limit" });

            using var ms = new MemoryStream();
            await file.CopyToAsync(ms);

            var userId = ctx.User.FindFirstValue(JwtRegisteredClaimNames.Sub);
            var doc = new CandidateDocument
            {
                Id = Guid.NewGuid(),
                CandidateId = id,
                FileName = file.FileName,
                ContentType = file.ContentType,
                FileSizeBytes = file.Length,
                FileData = ms.ToArray(),
                UploadedUtc = DateTime.UtcNow,
                UploadedByUserId = userId
            };
            db.CandidateDocuments.Add(doc);
            await db.SaveChangesAsync();
            return Results.Ok(new { doc.Id, doc.FileName, doc.ContentType, doc.FileSizeBytes, doc.UploadedUtc });
        }).DisableAntiforgery();

        // GET /api/v1/hiring/candidates/{id}/documents/{docId}  (download)
        g.MapGet("/candidates/{id:guid}/documents/{docId:guid}", async (
            Guid id, Guid docId, [FromServices] AppDbContext db) =>
        {
            var doc = await db.CandidateDocuments
                .FirstOrDefaultAsync(x => x.Id == docId && x.CandidateId == id);
            if (doc is null) return Results.NotFound();
            return Results.File(doc.FileData, doc.ContentType, doc.FileName);
        });

        // DELETE /api/v1/hiring/candidates/{id}/documents/{docId}
        g.MapDelete("/candidates/{id:guid}/documents/{docId:guid}", async (
            Guid id, Guid docId, [FromServices] AppDbContext db) =>
        {
            var doc = await db.CandidateDocuments
                .FirstOrDefaultAsync(x => x.Id == docId && x.CandidateId == id);
            if (doc is null) return Results.NotFound();
            db.CandidateDocuments.Remove(doc);
            await db.SaveChangesAsync();
            return Results.Ok(new { ok = true });
        });

        // ── Dashboard ──────────────────────────────────────────────────────────

        // GET /api/v1/hiring/dashboard?facilityId=&from=&to=
        g.MapGet("/dashboard", async (
            [FromQuery] Guid facilityId,
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to,
            [FromServices] AppDbContext db) =>
        {
            var fromDate = from ?? DateTime.UtcNow.Date;
            var toDate   = to   ?? fromDate.AddDays(1).AddSeconds(-1);

            var all = await db.HiringCandidates
                .Where(c => c.FacilityId == facilityId)
                .Select(c => new { c.Status, c.AppliedUtc, c.OnboardingStartedUtc, c.HiredUtc })
                .ToListAsync();

            var active    = all.Count(c => c.Status != CandidateStatus.Hired && c.Status != CandidateStatus.Rejected);
            var inHiring  = all.Count(c => c.Status == CandidateStatus.Applied || c.Status == CandidateStatus.Interviewing || c.Status == CandidateStatus.Offered);
            var inOnboard = all.Count(c => c.Status == CandidateStatus.Onboarding);
            var hired     = all.Count(c => c.Status == CandidateStatus.Hired);

            var appliedInRange    = all.Count(c => c.AppliedUtc >= fromDate && c.AppliedUtc <= toDate);
            var onboardedInRange  = all.Count(c => c.OnboardingStartedUtc.HasValue && c.OnboardingStartedUtc >= fromDate && c.OnboardingStartedUtc <= toDate);
            var hiredInRange      = all.Count(c => c.HiredUtc.HasValue && c.HiredUtc >= fromDate && c.HiredUtc <= toDate);

            return Results.Ok(new
            {
                Active         = active,
                InHiring       = inHiring,
                InOnboarding   = inOnboard,
                TotalHired     = hired,
                AppliedInRange = appliedInRange,
                OnboardedInRange = onboardedInRange,
                HiredInRange   = hiredInRange,
            });
        });

        // ── Staff Documents ────────────────────────────────────────────────────

        // GET /api/v1/hiring/staff/{staffId}/documents
        g.MapGet("/staff/{staffId:guid}/documents", async (
            Guid staffId, [FromServices] AppDbContext db) =>
        {
            var docs = await db.StaffDocuments
                .Where(d => d.StaffId == staffId)
                .OrderByDescending(d => d.UploadedUtc)
                .Select(d => new { d.Id, d.FileName, d.ContentType, d.FileSizeBytes, d.UploadedUtc })
                .AsNoTracking()
                .ToListAsync();
            return Results.Ok(docs);
        });

        // POST /api/v1/hiring/staff/{staffId}/documents
        g.MapPost("/staff/{staffId:guid}/documents", async (
            Guid staffId,
            HttpContext ctx,
            [FromServices] AppDbContext db) =>
        {
            if (!await db.Staff.AnyAsync(s => s.Id == staffId))
                return Results.NotFound();

            var file = ctx.Request.Form.Files.FirstOrDefault();
            if (file is null || file.Length == 0)
                return Results.BadRequest(new { error = "No file provided" });
            if (file.Length > 20 * 1024 * 1024)
                return Results.BadRequest(new { error = "File exceeds 20 MB limit" });

            using var ms = new MemoryStream();
            await file.CopyToAsync(ms);

            var userId = ctx.User.FindFirstValue(JwtRegisteredClaimNames.Sub);
            var doc = new StaffDocument
            {
                Id = Guid.NewGuid(),
                StaffId = staffId,
                FileName = file.FileName,
                ContentType = file.ContentType,
                FileSizeBytes = file.Length,
                FileData = ms.ToArray(),
                UploadedUtc = DateTime.UtcNow,
                UploadedByUserId = userId
            };
            db.StaffDocuments.Add(doc);
            await db.SaveChangesAsync();
            return Results.Ok(new { doc.Id, doc.FileName, doc.ContentType, doc.FileSizeBytes, doc.UploadedUtc });
        }).DisableAntiforgery();

        // GET /api/v1/hiring/staff/{staffId}/documents/{docId}  (download)
        g.MapGet("/staff/{staffId:guid}/documents/{docId:guid}", async (
            Guid staffId, Guid docId, [FromServices] AppDbContext db) =>
        {
            var doc = await db.StaffDocuments
                .FirstOrDefaultAsync(x => x.Id == docId && x.StaffId == staffId);
            if (doc is null) return Results.NotFound();
            return Results.File(doc.FileData, doc.ContentType, doc.FileName);
        });

        // DELETE /api/v1/hiring/staff/{staffId}/documents/{docId}
        g.MapDelete("/staff/{staffId:guid}/documents/{docId:guid}", async (
            Guid staffId, Guid docId, [FromServices] AppDbContext db) =>
        {
            var doc = await db.StaffDocuments
                .FirstOrDefaultAsync(x => x.Id == docId && x.StaffId == staffId);
            if (doc is null) return Results.NotFound();
            db.StaffDocuments.Remove(doc);
            await db.SaveChangesAsync();
            return Results.Ok(new { ok = true });
        });

        return v1;
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    static async Task<List<HiringChecklistTemplate>> EnsureDefaultTemplates(AppDbContext db, Guid facilityId)
    {
        var existing = await db.HiringChecklistTemplates
            .Where(t => t.FacilityId == facilityId).ToListAsync();
        if (existing.Any()) return existing;

        var items = DefaultChecklistItems.Select((name, i) => new HiringChecklistTemplate
        {
            Id = Guid.NewGuid(),
            FacilityId = facilityId,
            Name = name,
            IsDefault = true,
            SortOrder = i + 1
        }).ToList();

        db.HiringChecklistTemplates.AddRange(items);
        await db.SaveChangesAsync();
        return items;
    }

    static object ToCandidateDto(HiringCandidate c) => new
    {
        c.Id,
        c.FacilityId,
        c.FirstName,
        c.LastName,
        c.Email,
        c.Phone,
        c.Position,
        Status = c.Status.ToString(),
        c.AppliedUtc,
        c.OnboardingStartedUtc,
        c.HiredUtc,
        c.Notes,
        c.LinkedStaffId,
        ChecklistItems = c.ChecklistItems.Select(i => new
        {
            i.Id,
            i.Name,
            i.IsChecked,
            i.CheckedUtc,
            i.DocumentId,
        }).OrderBy(i => i.Name).ToList(),
        Documents = c.Documents.Select(d => new
        {
            d.Id,
            d.FileName,
            d.ContentType,
            d.FileSizeBytes,
            d.UploadedUtc,
        }).OrderByDescending(d => d.UploadedUtc).ToList(),
        AllChecked   = c.ChecklistItems.Any() && c.ChecklistItems.All(i => i.IsChecked),
        ChecklistPct = c.ChecklistItems.Any()
            ? (int)Math.Round(c.ChecklistItems.Count(i => i.IsChecked) * 100.0 / c.ChecklistItems.Count)
            : 0,
    };
}

// ── Request Records ────────────────────────────────────────────────────────────
public record AddTemplateRequest(Guid FacilityId, string Name);
public record CreateCandidateRequest(
    Guid FacilityId, string FirstName, string LastName,
    string? Email, string? Phone, string? Position, string? Notes);
public record UpdateCandidateRequest(
    string? FirstName, string? LastName, string? Email,
    string? Phone, string? Position, string? Notes, CandidateStatus? Status);
public record ToggleChecklistRequest(bool IsChecked);
public record AddChecklistItemRequest(string Name);
