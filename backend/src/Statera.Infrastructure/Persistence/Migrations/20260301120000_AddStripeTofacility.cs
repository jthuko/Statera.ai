using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Statera.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddStripeTofacility : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "StripeCustomerId",
                table: "Facilities",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StripeSubscriptionId",
                table: "Facilities",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StripeCustomerId",
                table: "Facilities");

            migrationBuilder.DropColumn(
                name: "StripeSubscriptionId",
                table: "Facilities");
        }
    }
}
