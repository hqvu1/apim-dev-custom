import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { usePortalApi } from "../api/client";
import PageHeader from "../components/PageHeader";

const ApiTryIt = () => {
  const { apiId } = useParams();
  const { get } = usePortalApi();
  const [operations, setOperations] = useState<string[]>(["GET /claims", "POST /claims"]);
  const [response, setResponse] = useState("{}");
  const sampleBody = "{\n  \"claimId\": \"123\"\n}";

  useEffect(() => {
    const load = async () => {
      const result = await get<{ operations: string[] }>(`/apis/${apiId}/try-config`);
      if (result.data?.operations?.length) {
        setOperations(result.data.operations);
      }
    };

    load();
  }, [apiId, get]);

  return (
    <Box>
      <PageHeader
        title="Try-It Console"
        subtitle="Experiment with sandbox endpoints using short-lived keys from Infosys APIM."
      />
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Operations
              </Typography>
              <List>
                {operations.map((operation) => (
                  <ListItem key={operation} disablePadding>
                    <ListItemButton>
                      <ListItemText primary={operation} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Request Builder
              </Typography>
              <Stack spacing={2}>
                <TextField label="Request URL" fullWidth defaultValue="/claims" />
                <TextField label="Headers" fullWidth defaultValue="Authorization: Bearer ..." />
                <TextField
                  label="JSON Body"
                  multiline
                  minRows={6}
                  defaultValue={sampleBody}
                />
                <Button variant="contained">Send Request</Button>
                <Divider />
                <Typography variant="subtitle1" fontWeight={600}>
                  Response
                </Typography>
                <TextField
                  multiline
                  minRows={6}
                  value={response}
                  onChange={(event) => setResponse(event.target.value)}
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ApiTryIt;
