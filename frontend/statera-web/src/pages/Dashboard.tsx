import { AppBar, Toolbar, Typography, Container, Button } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
export default function Dashboard(){
  const { signOut } = useAuth();
  return (<>
    <AppBar position="static"><Toolbar>
      <Typography variant="h6" sx={{ flexGrow: 1 }}>Statera Dashboard</Typography>
      <Button color="inherit" component={RouterLink} to="/scheduler">Scheduler</Button>
      <Button color="inherit" onClick={()=>signOut()}>Logout</Button>
    </Toolbar></AppBar>
    <Container sx={{ mt:3 }}><Typography>Welcome. Use the Scheduler to generate AI suggestions.</Typography></Container>
  </>);
}
