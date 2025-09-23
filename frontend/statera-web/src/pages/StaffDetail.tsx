import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Page from "./_Page";
import { Card, CardContent, Typography, Stack, Divider, Chip, Skeleton, Alert } from "@mui/material";
import { getStaff } from "../api/endpoints";

export default function StaffDetail() {
  const { id } = useParams(); // GUID string
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await getStaff(id);
        if (!alive) return;
        setData(res);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Failed to load staff.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const first = data?.firstName ?? data?.FirstName ?? data?.first_name ?? "";
  const last  = data?.lastName  ?? data?.LastName  ?? data?.last_name  ?? "";
  const name  = (data?.name || `${first} ${last}`.trim()).trim();
  const role  = data?.role?.name ?? data?.roleName ?? data?.role ?? null;
  const unit  = data?.unit?.name ?? data?.unitName ?? data?.unit ?? null;
  const credential = data?.credential ?? data?.Credential ?? null;
  const email = data?.email ?? data?.Email ?? null;
  const phone = data?.phone ?? data?.Phone ?? null;
  const active = data?.active ?? data?.Active ?? true;

  return (
    <Page title={`Staff #${id}`}>
      {err && <Alert severity="error">{err}</Alert>}

      <Card>
        <CardContent>
          {loading ? (
            <Stack spacing={1}>
              <Skeleton width={220} height={32} />
              <Skeleton width={160} />
              <Skeleton width={160} />
              <Skeleton width={240} />
            </Stack>
          ) : (
            <Stack spacing={1}>
              <Typography variant="h5" fontWeight={700}>
                {name || `(Unnamed #${id})`}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                {role && <Chip label={role} />}
                {credential && <Chip label={credential} />}
                {unit && <Chip label={unit} />}
                <Chip label={active ? "Active" : "Inactive"} color={active ? "success" : "default"} />
              </Stack>

              <Divider sx={{ my: 2 }} />

              {email && (
                <Typography>
                  <strong>Email:</strong> {email}
                </Typography>
              )}
              {phone && (
                <Typography>
                  <strong>Phone:</strong> {phone}
                </Typography>
              )}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
