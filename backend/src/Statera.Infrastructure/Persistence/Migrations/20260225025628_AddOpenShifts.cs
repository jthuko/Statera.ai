using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Statera.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOpenShifts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "staff");

            migrationBuilder.AddColumn<string>(
                name: "RoleId",
                table: "Assignments",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SystemRole",
                table: "AspNetUsers",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "FacilityAdmin");

            migrationBuilder.CreateTable(
                name: "ChatRooms",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FacilityId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Type = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false, defaultValue: "Direct"),
                    CreatedByUserId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatRooms", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HelpArticles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Category = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    TagsJson = table.Column<string>(type: "nvarchar(max)", nullable: false, defaultValue: "[]"),
                    SectionsJson = table.Column<string>(type: "nvarchar(max)", nullable: false, defaultValue: "[]"),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HelpArticles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OpenShifts",
                schema: "staff",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FacilityId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UnitId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Role = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    StartUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "Open"),
                    CreatedByUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    CreatedUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OpenShifts", x => x.Id);
                    table.CheckConstraint("CK_OpenShift_EndAfterStart", "[EndUtc] > [StartUtc]");
                });

            migrationBuilder.CreateTable(
                name: "TimeClockEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StaffId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FacilityId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UnitId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ClockInUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ClockOutUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LunchOutUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LunchInUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsManual = table.Column<bool>(type: "bit", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "ClockedIn"),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    AdminNotes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ReviewedByUserId = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ReviewedUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CorrectionNotes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CorrectedClockInUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CorrectedClockOutUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CorrectedLunchOutUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CorrectedLunchInUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TimeClockEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TimeClockEntries_Staff_StaffId",
                        column: x => x.StaffId,
                        principalTable: "Staff",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserFacilityRoles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    FacilityId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FacilityRole = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    AssignedUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    AssignedByUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserFacilityRoles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserFacilityRoles_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserFacilityRoles_Facilities_FacilityId",
                        column: x => x.FacilityId,
                        principalTable: "Facilities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ChatMessages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoomId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SenderUserId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Content = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    SentUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatMessages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChatMessages_ChatRooms_RoomId",
                        column: x => x.RoomId,
                        principalTable: "ChatRooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ChatRoomMembers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoomId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    JoinedUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastReadUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatRoomMembers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChatRoomMembers_ChatRooms_RoomId",
                        column: x => x.RoomId,
                        principalTable: "ChatRooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OpenShiftRequests",
                schema: "staff",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OpenShiftId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StaffId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "Pending"),
                    RequestedUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ReviewedByUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: true),
                    ReviewedUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OpenShiftRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OpenShiftRequests_OpenShifts_OpenShiftId",
                        column: x => x.OpenShiftId,
                        principalSchema: "staff",
                        principalTable: "OpenShifts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessages_RoomId_SentUtc",
                table: "ChatMessages",
                columns: new[] { "RoomId", "SentUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ChatRoomMembers_RoomId_UserId",
                table: "ChatRoomMembers",
                columns: new[] { "RoomId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_HelpArticles_Category_SortOrder",
                table: "HelpArticles",
                columns: new[] { "Category", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_OpenShiftRequests_OpenShiftId_StaffId",
                schema: "staff",
                table: "OpenShiftRequests",
                columns: new[] { "OpenShiftId", "StaffId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OpenShiftRequests_StaffId",
                schema: "staff",
                table: "OpenShiftRequests",
                column: "StaffId");

            migrationBuilder.CreateIndex(
                name: "IX_OpenShifts_FacilityId_StartUtc",
                schema: "staff",
                table: "OpenShifts",
                columns: new[] { "FacilityId", "StartUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_OpenShifts_Status",
                schema: "staff",
                table: "OpenShifts",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_TimeClockEntries_FacilityId",
                table: "TimeClockEntries",
                column: "FacilityId");

            migrationBuilder.CreateIndex(
                name: "IX_TimeClockEntries_StaffId_ClockInUtc",
                table: "TimeClockEntries",
                columns: new[] { "StaffId", "ClockInUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_UserFacilityRoles_FacilityId",
                table: "UserFacilityRoles",
                column: "FacilityId");

            migrationBuilder.CreateIndex(
                name: "IX_UserFacilityRoles_UserId_FacilityId",
                table: "UserFacilityRoles",
                columns: new[] { "UserId", "FacilityId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ChatMessages");

            migrationBuilder.DropTable(
                name: "ChatRoomMembers");

            migrationBuilder.DropTable(
                name: "HelpArticles");

            migrationBuilder.DropTable(
                name: "OpenShiftRequests",
                schema: "staff");

            migrationBuilder.DropTable(
                name: "TimeClockEntries");

            migrationBuilder.DropTable(
                name: "UserFacilityRoles");

            migrationBuilder.DropTable(
                name: "ChatRooms");

            migrationBuilder.DropTable(
                name: "OpenShifts",
                schema: "staff");

            migrationBuilder.DropColumn(
                name: "RoleId",
                table: "Assignments");

            migrationBuilder.DropColumn(
                name: "SystemRole",
                table: "AspNetUsers");
        }
    }
}
