using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Statera.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddStaffProfile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Phone",
                table: "Staff",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Address1",
                table: "Staff",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Address2",
                table: "Staff",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "City",
                table: "Staff",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "State",
                table: "Staff",
                type: "nvarchar(2)",
                maxLength: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Zip",
                table: "Staff",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "DateOfBirth",
                table: "Staff",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmergencyContactName",
                table: "Staff",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmergencyContactPhone",
                table: "Staff",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PhotoUrl",
                table: "Staff",
                type: "nvarchar(512)",
                maxLength: 512,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "Phone", table: "Staff");
            migrationBuilder.DropColumn(name: "Address1", table: "Staff");
            migrationBuilder.DropColumn(name: "Address2", table: "Staff");
            migrationBuilder.DropColumn(name: "City", table: "Staff");
            migrationBuilder.DropColumn(name: "State", table: "Staff");
            migrationBuilder.DropColumn(name: "Zip", table: "Staff");
            migrationBuilder.DropColumn(name: "DateOfBirth", table: "Staff");
            migrationBuilder.DropColumn(name: "EmergencyContactName", table: "Staff");
            migrationBuilder.DropColumn(name: "EmergencyContactPhone", table: "Staff");
            migrationBuilder.DropColumn(name: "PhotoUrl", table: "Staff");
        }
    }
}
