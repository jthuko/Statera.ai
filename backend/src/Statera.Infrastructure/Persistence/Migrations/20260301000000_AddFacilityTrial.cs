using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Statera.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFacilityTrial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PlanStatus",
                table: "Facilities",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Trial");

            migrationBuilder.AddColumn<DateTime>(
                name: "TrialEndsUtc",
                table: "Facilities",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "TrialStartUtc",
                table: "Facilities",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PlanStatus",
                table: "Facilities");

            migrationBuilder.DropColumn(
                name: "TrialEndsUtc",
                table: "Facilities");

            migrationBuilder.DropColumn(
                name: "TrialStartUtc",
                table: "Facilities");
        }
    }
}
