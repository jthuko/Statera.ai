using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Statera.Domain.Staffing;

public class RuleConstraintConfig : IEntityTypeConfiguration<RuleConstraint>
{
    public void Configure(EntityTypeBuilder<RuleConstraint> b)
    {
        b.ToTable("RuleConstraints", "staff");
        b.HasKey(x => x.Id);
        b.Property(x => x.Scope).HasConversion<string>().IsRequired();
        b.Property(x => x.Type).HasConversion<string>().IsRequired();
        b.Property(x => x.Value).HasMaxLength(1024).IsRequired();
        b.Property(x => x.Role).HasMaxLength(64);
        b.Property(x => x.Notes).HasMaxLength(1024);
        b.HasIndex(x => new { x.FacilityId, x.Scope, x.Type });
    }
}
