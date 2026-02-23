# Statera.ai Feature Plan

## Phase 1 — Quick Fixes (all frontend, no backend restart needed)

### 1.1 Scheduler — Accept button visibility
- **File**: `frontend/statera-web/src/pages/Scheduler.tsx`
- Button uses `variant="outlined"` which blends into the table background in dark mode
- Fix: change to `variant="contained"` color="primary"
- Same fix in `FacilityAdminPage.tsx` SchedulerTab

### 1.2 Demand Templates — nav icon
- **File**: `frontend/statera-web/src/components/AppShell.tsx` line 62
- `icon: <ListItemIcon />` renders an empty MUI wrapper — no icon shows at all
- Fix: replace with `<EventNote />` from `@mui/icons-material`

### 1.3 Demand Templates — facility selector + more rules
- **File**: `frontend/statera-web/src/pages/demand-templates/index.tsx`
- Add a facility `<Select>` at the top (same pattern as TimeOff page)
- Pass `facilityId` to `listDemandTemplates()` call
- "More rules" on templates: the backend DemandTemplateDay already has `day` + `required`.
  Add `shiftType` (Day/Evening/Night) and `role` columns to the day rows so demand
  can be specified per-shift-type and per-role, not just per-day.
  This requires a backend schema change — add `ShiftType?` and `Role?` to `DemandTemplateDay`.

### 1.4 Facilities — name link visibility
- **File**: `frontend/statera-web/src/components/facilities/FacilitiesTable.tsx`
- The drawer background is `#0b1214`; the table is on a white/paper surface, so the
  MUI Link should be visible. If it's a dark theme table the issue is that `variant="body2"`
  defaults to the theme's link color which may not contrast.
- Fix: add `sx={{ color: "primary.main" }}` explicitly on the Link.

### 1.5 Time Off search
- Backend is already fixed (searches both Reason and staff name)
- Backend needs to be restarted to pick up the change
- Frontend is reactive — no Apply button needed now

### 1.6 Individualized constraints — Staff Availability UI
- `StaffAvailability` entity already exists (`DayOfWeek`, `StartLocal`, `EndLocal`)
- **Missing**: there are no API endpoints for it and no frontend UI
- Backend: add `GET /staff/{id}/availability` and `PUT /staff/{id}/availability`
- Frontend: add "Availability" tab to `StaffDetail` page with a day-of-week grid
  showing which days the staff member works and their hours
- The scheduler's `suggestAssignments` already filters on `StaffAvailability`
  (or will if we pass it — need to verify SchedulerEndpoints reads it)

---

## Phase 2 — Staff Portal

### Auth changes
- Add `"Staff"` to `SystemRole` union in `AuthContext.tsx` and `useAuth`
- When a user with `systemRole === "Staff"` logs in, `RequireAuth` redirects them to `/portal`
- Admin routes (`/`, `/staff`, `/assignments`, etc.) redirect Staff users back to `/portal`
- Add `POST /staff/{id}/create-portal-account` backend endpoint (creates AppUser with
  `SystemRole = "Staff"` linked by email, random temp password returned once)
- Add "Create Portal Account" button in StaffDetail page

### New route tree
```
/portal                    PortalShell (new layout — no admin drawer)
  /portal                  PortalDashboard (my shifts this week, pending time-off, clock status)
  /portal/schedule         MySchedule (week/month calendar of assigned shifts)
  /portal/timeoff          MyTimeOff (list own requests + new request form)
  /portal/timeclock        TimeClock (big clock-in/out button + daily log)
  /portal/timesheet        MyTimesheet (calendar + CSV download)
  /portal/chat             StaffChat (1:1 and group messages)
```

### PortalShell
- Simpler top navbar (no admin drawer)
- Bottom nav bar on mobile (Dashboard / Schedule / Time Off / Clock / Chat)
- Shows staff name + facility name

---

## Phase 3 — Time Clock

### Backend
New entity in `Entities.cs`:
```csharp
public class TimeClockEntry {
    public Guid Id { get; set; }
    public Guid StaffId { get; set; }
    public Guid FacilityId { get; set; }
    public Guid? UnitId { get; set; }
    public DateTime ClockInUtc { get; set; }
    public DateTime? ClockOutUtc { get; set; }
    public bool IsManual { get; set; }       // true = manually entered by admin
    public string Status { get; set; }       // "ClockedIn" | "ClockedOut" | "Approved" | "Denied" | "Adjusted"
    public string? Notes { get; set; }       // staff note
    public string? AdminNotes { get; set; }  // admin review note
    public string? ReviewedByUserId { get; set; }
    public DateTime? ReviewedUtc { get; set; }
}
```

New `TimeClockEndpoints.cs`:
- `POST /timeclock/clockin` — staff clocks in (creates entry, Status = ClockedIn)
- `POST /timeclock/clockout` — staff clocks out (sets ClockOutUtc, Status = ClockedOut)
- `GET /timeclock/active` — returns staff's currently open entry (no ClockOutUtc)
- `GET /timeclock?facilityId=&staffId=&from=&to=&status=&page=` — paginated list
- `PATCH /timeclock/{id}/review` — admin: approve / deny / adjust (set times + AdminNotes)
- `PUT /timeclock/{id}` — admin manual entry (IsManual = true)

Add `DbSet<TimeClockEntry>` to `AppDbContext.cs` + configure.
Seed re-runs on startup so no migration needed.

### Staff Portal — Time Clock page (`/portal/timeclock`)
- Large "Clock In" / "Clock Out" button depending on active entry
- Shows today's entries with start/end times and duration
- History tab: last 14 days with status chips

### Admin — Time Clock review
- New tab "Time Clock" in `FacilityAdminPage.tsx`
- DataGrid of entries filtered by date range and status
- "Review" dialog (same pattern as TimeOffReviewDialog):
  - Shows staff, clock-in, clock-out, duration
  - Approve / Deny / Adjust buttons
  - "Adjust" mode: editable datetime fields + required AdminNotes
  - Deny requires AdminNotes (note sent back to staff)

---

## Phase 4 — Timesheet

### Staff Portal — `/portal/timesheet`
- Left panel: month calendar (MUI X DateCalendar)
  - Assigned shifts shown as green dots
  - Clock-in days shown as blue dots
  - Time-off days shown as orange dots
- Right panel: selected week detail (shifts + clocked hours + total)
- "Download CSV" button: generates client-side CSV with columns:
  Date | Shift Start | Shift End | Scheduled Hours | Clock In | Clock Out | Worked Hours | Status

### Worked Hours download
- Same CSV but filtered to just time clock rows
- Includes admin-adjusted times and approval status

---

## Phase 5 — Chat

### Backend
New entities in `Entities.cs`:
```csharp
public class ChatRoom {
    public Guid Id { get; set; }
    public Guid FacilityId { get; set; }
    public string? Name { get; set; }       // null for Direct (1:1)
    public string Type { get; set; }        // "Direct" | "Group"
    public string CreatedByUserId { get; set; }
    public DateTime CreatedUtc { get; set; }
    public ICollection<ChatRoomMember> Members { get; set; }
    public ICollection<ChatMessage> Messages { get; set; }
}
public class ChatRoomMember {
    public Guid Id { get; set; }
    public Guid RoomId { get; set; }
    public string UserId { get; set; }
    public DateTime JoinedUtc { get; set; }
    public DateTime? LastReadUtc { get; set; }
}
public class ChatMessage {
    public Guid Id { get; set; }
    public Guid RoomId { get; set; }
    public string SenderUserId { get; set; }
    public string Content { get; set; }
    public DateTime SentUtc { get; set; }
    public bool IsDeleted { get; set; }
}
```

New `ChatEndpoints.cs`:
- `GET /chat/rooms` — list rooms where current user is a member (with last message + unread count)
- `POST /chat/rooms` — create Direct or Group room
- `POST /chat/rooms/{id}/members` — add member to group
- `DELETE /chat/rooms/{id}/members/{userId}` — remove member
- `GET /chat/rooms/{id}/messages?before=&limit=50` — paginated messages
- `POST /chat/rooms/{id}/messages` — send message
- `POST /chat/rooms/{id}/read` — mark all as read (sets LastReadUtc)

Real-time: polling every 5 seconds (simple HTTP, no SignalR for now).
Unread count badge derived from messages newer than `LastReadUtc`.

### Admin `/chat`
- Sidebar: list of rooms (DMs + groups) with unread badge
- Main area: message thread + send box
- "New Group" FAB: name input + member picker (search staff/users)
- Click on staff name anywhere in app → opens/creates DM

### Staff Portal `/portal/chat`
- Same UI as admin chat but scoped to their facility
- Cannot create groups (admin-only)
- Can start DMs with other staff or admin

---

## Implementation Order
1. Phase 1 fixes (fast, all done in frontend except StaffAvailability endpoint)
2. Phase 2 Staff Portal (routing + shell + portal pages)
3. Phase 3 Time Clock (backend entity + endpoints + UI)
4. Phase 4 Timesheet (calendar view + CSV export)
5. Phase 5 Chat (backend + polling chat UI)
