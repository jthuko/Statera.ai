using System;
using System.Linq;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Statera.Domain;
using Statera.Api.Authorization;
using Statera.Infrastructure;

namespace Statera.Api.Endpoints;

public static class ChatEndpoints
{
    public static RouteGroupBuilder MapChatEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/chat").WithTags("Chat").RequireAuthorization()
            .AddEndpointFilter(async (ctx, next) =>
            {
                // Chat (AI Assistant) requires Growth plan or higher
                if (!TierEnforcement.CanAccessGrowthFeature(ctx.HttpContext))
                    return TierEnforcement.UpgradeRequired();
                return await next(ctx);
            });

        // GET /api/v1/chat/rooms  — rooms where current user is a member
        g.MapGet("/rooms", async (HttpContext ctx, [FromServices] AppDbContext db) =>
        {
            var userId = ctx.User.FindFirstValue(JwtRegisteredClaimNames.Sub);
            if (userId is null) return Results.Unauthorized();

            var rooms = await db.ChatRooms.AsNoTracking()
                .Where(r => r.Members.Any(m => m.UserId == userId))
                .Include(r => r.Members)
                .Include(r => r.Messages.OrderByDescending(m => m.SentUtc).Take(1))
                .OrderByDescending(r => r.Messages.Max(m => (DateTime?)m.SentUtc) ?? r.CreatedUtc)
                .ToListAsync();

            var userIds = rooms.SelectMany(r => r.Members.Select(m => m.UserId)).Distinct().ToList();
            var users   = await db.Users.AsNoTracking()
                .Where(u => userIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u.Email ?? u.UserName ?? u.Id);

            return Results.Ok(rooms.Select(r =>
            {
                var myMember  = r.Members.FirstOrDefault(m => m.UserId == userId);
                var lastMsg   = r.Messages.OrderByDescending(m => m.SentUtc).FirstOrDefault();
                var unread    = r.Messages.Count(m => myMember?.LastReadUtc == null || m.SentUtc > myMember.LastReadUtc);
                var memberInfos = r.Members.Select(m => new { m.UserId, DisplayName = users.GetValueOrDefault(m.UserId, m.UserId) });
                return new
                {
                    r.Id, r.FacilityId, r.Name, r.Type, r.CreatedUtc,
                    Members        = memberInfos,
                    LastMessage    = lastMsg?.Content,
                    LastMessageUtc = lastMsg?.SentUtc,
                    UnreadCount    = unread,
                };
            }));
        });

        // POST /api/v1/chat/rooms  — create Direct or Group room
        g.MapPost("/rooms", async (
            [FromBody] CreateRoomRequest req,
            HttpContext ctx,
            [FromServices] AppDbContext db) =>
        {
            var userId = ctx.User.FindFirstValue(JwtRegisteredClaimNames.Sub);
            if (userId is null) return Results.Unauthorized();

            // For Direct chats: check if a DM already exists between these two users
            if (req.Type == "Direct" && req.MemberUserIds?.Count == 1)
            {
                var otherId = req.MemberUserIds[0];
                var existing = await db.ChatRooms.AsNoTracking()
                    .Where(r => r.Type == "Direct" && r.FacilityId == req.FacilityId
                                && r.Members.Any(m => m.UserId == userId)
                                && r.Members.Any(m => m.UserId == otherId))
                    .FirstOrDefaultAsync();
                if (existing is not null)
                {
                    // Return the same shape as a newly created room so the client can use it directly
                    var exRoom = await db.ChatRooms.AsNoTracking()
                        .Include(r => r.Members)
                        .Include(r => r.Messages.OrderByDescending(m => m.SentUtc).Take(1))
                        .FirstAsync(r => r.Id == existing.Id);
                    var exUserIds = exRoom.Members.Select(m => m.UserId).Distinct().ToList();
                    var exUsers   = await db.Users.AsNoTracking()
                        .Where(u => exUserIds.Contains(u.Id))
                        .ToDictionaryAsync(u => u.Id, u => u.Email ?? u.UserName ?? u.Id);
                    var exLastMsg = exRoom.Messages.OrderByDescending(m => m.SentUtc).FirstOrDefault();
                    return Results.Ok(new
                    {
                        exRoom.Id, exRoom.FacilityId, exRoom.Name, exRoom.Type, exRoom.CreatedUtc,
                        Members        = exRoom.Members.Select(m => new { m.UserId, DisplayName = exUsers.GetValueOrDefault(m.UserId, m.UserId) }),
                        LastMessage    = exLastMsg?.Content,
                        LastMessageUtc = exLastMsg?.SentUtc,
                        UnreadCount    = 0,
                    });
                }
            }

            var room = new ChatRoom
            {
                Id              = Guid.NewGuid(),
                FacilityId      = req.FacilityId,
                Name            = req.Name,
                Type            = req.Type ?? "Direct",
                CreatedByUserId = userId,
                CreatedUtc      = DateTime.UtcNow,
            };

            // Always add creator as member
            var allMemberIds = new HashSet<string> { userId };
            foreach (var mid in req.MemberUserIds ?? new List<string>())
                allMemberIds.Add(mid);

            room.Members = allMemberIds.Select(uid => new ChatRoomMember
            {
                Id        = Guid.NewGuid(),
                RoomId    = room.Id,
                UserId    = uid,
                JoinedUtc = DateTime.UtcNow,
            }).ToList();

            db.ChatRooms.Add(room);
            await db.SaveChangesAsync();

            // Reload with full shape so the frontend can use it immediately
            var newRoom = await db.ChatRooms.AsNoTracking()
                .Include(r => r.Members)
                .Include(r => r.Messages.OrderByDescending(m => m.SentUtc).Take(1))
                .FirstAsync(r => r.Id == room.Id);
            var newUserIds = newRoom.Members.Select(m => m.UserId).Distinct().ToList();
            var newUsers   = await db.Users.AsNoTracking()
                .Where(u => newUserIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u.Email ?? u.UserName ?? u.Id);
            var newLastMsg = newRoom.Messages.OrderByDescending(m => m.SentUtc).FirstOrDefault();
            return Results.Created($"/api/v1/chat/rooms/{room.Id}", new
            {
                newRoom.Id, newRoom.FacilityId, newRoom.Name, newRoom.Type, newRoom.CreatedUtc,
                Members        = newRoom.Members.Select(m => new { m.UserId, DisplayName = newUsers.GetValueOrDefault(m.UserId, m.UserId) }),
                LastMessage    = newLastMsg?.Content,
                LastMessageUtc = newLastMsg?.SentUtc,
                UnreadCount    = 0,
            });
        });

        // POST /api/v1/chat/rooms/{id}/members
        g.MapPost("/rooms/{id:guid}/members", async (
            Guid id,
            [FromBody] AddMemberRequest req,
            [FromServices] AppDbContext db) =>
        {
            var room = await db.ChatRooms.Include(r => r.Members).FirstOrDefaultAsync(r => r.Id == id);
            if (room is null) return Results.NotFound();

            if (room.Members.Any(m => m.UserId == req.UserId))
                return Results.Conflict(new { error = "User is already a member." });

            room.Members.Add(new ChatRoomMember
            {
                Id = Guid.NewGuid(), RoomId = id, UserId = req.UserId, JoinedUtc = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // DELETE /api/v1/chat/rooms/{id}/members/{userId}
        g.MapDelete("/rooms/{id:guid}/members/{userId}", async (
            Guid id, string userId, [FromServices] AppDbContext db) =>
        {
            var member = await db.ChatRoomMembers.FirstOrDefaultAsync(m => m.RoomId == id && m.UserId == userId);
            if (member is null) return Results.NotFound();
            db.ChatRoomMembers.Remove(member);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // GET /api/v1/chat/rooms/{id}/messages?before=&limit=50
        g.MapGet("/rooms/{id:guid}/messages", async (
            Guid id,
            [FromServices] AppDbContext db,
            [FromQuery] DateTime? before,
            [FromQuery] int limit = 50) =>
        {
            var q = db.ChatMessages.AsNoTracking()
                .Where(m => m.RoomId == id && !m.IsDeleted);

            if (before.HasValue)
                q = q.Where(m => m.SentUtc < DateTime.SpecifyKind(before.Value, DateTimeKind.Utc));

            var msgs = await q
                .OrderByDescending(m => m.SentUtc)
                .Take(Math.Clamp(limit, 1, 100))
                .ToListAsync();

            // Resolve sender display names
            var senderIds = msgs.Select(m => m.SenderUserId).Distinct().ToList();
            var users = await db.Users.AsNoTracking()
                .Where(u => senderIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u.Email ?? u.UserName ?? u.Id);

            return Results.Ok(msgs.OrderBy(m => m.SentUtc).Select(m => new
            {
                m.Id, m.RoomId, m.SenderUserId,
                SenderName  = users.GetValueOrDefault(m.SenderUserId, m.SenderUserId),
                m.Content, m.SentUtc, m.IsDeleted,
            }));
        });

        // POST /api/v1/chat/rooms/{id}/messages
        g.MapPost("/rooms/{id:guid}/messages", async (
            Guid id,
            [FromBody] SendMessageRequest req,
            HttpContext ctx,
            [FromServices] AppDbContext db) =>
        {
            var userId = ctx.User.FindFirstValue(JwtRegisteredClaimNames.Sub);
            if (userId is null) return Results.Unauthorized();

            var room = await db.ChatRooms.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id);
            if (room is null) return Results.NotFound();

            if (string.IsNullOrWhiteSpace(req.Content))
                return Results.BadRequest(new { error = "Message content is required." });

            var msg = new ChatMessage
            {
                Id            = Guid.NewGuid(),
                RoomId        = id,
                SenderUserId  = userId,
                Content       = req.Content.Trim(),
                SentUtc       = DateTime.UtcNow,
                IsDeleted     = false,
            };
            db.ChatMessages.Add(msg);
            await db.SaveChangesAsync();

            var senderName = await db.Users.AsNoTracking()
                .Where(u => u.Id == userId)
                .Select(u => u.Email ?? u.UserName ?? userId)
                .FirstOrDefaultAsync() ?? userId;

            return Results.Created($"/api/v1/chat/rooms/{id}/messages/{msg.Id}", new
            {
                msg.Id, msg.RoomId, msg.SenderUserId,
                SenderName  = senderName,
                msg.Content, msg.SentUtc, msg.IsDeleted,
            });
        });

        // POST /api/v1/chat/rooms/{id}/read  — mark all messages as read
        g.MapPost("/rooms/{id:guid}/read", async (
            Guid id,
            HttpContext ctx,
            [FromServices] AppDbContext db) =>
        {
            var userId = ctx.User.FindFirstValue(JwtRegisteredClaimNames.Sub);
            if (userId is null) return Results.Unauthorized();

            var member = await db.ChatRoomMembers.FirstOrDefaultAsync(m => m.RoomId == id && m.UserId == userId);
            if (member is null) return Results.NotFound();

            member.LastReadUtc = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        return v1;
    }

    private record CreateRoomRequest(Guid FacilityId, string? Name, string? Type, List<string>? MemberUserIds);
    private record AddMemberRequest(string UserId);
    private record SendMessageRequest(string Content);
}
