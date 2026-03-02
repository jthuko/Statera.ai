using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Statera.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPlanTierToFacility : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PlanTier",
                table: "Facilities",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Growth");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PlanTier",
                table: "Facilities");
        }
    }
}
