import { Container } from "@mui/material";
import FacilitiesTable from "../components/facilities/FacilitiesTable";

export default function FacilitiesPage() {
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <FacilitiesTable />
    </Container>
  );
}
