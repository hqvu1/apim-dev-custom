import { Box, Button, Grid, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { usePortalApi } from "../api/client";
import PageHeader from "../components/PageHeader";

const Register = () => {
  const { get, post } = usePortalApi();
  const [fields, setFields] = useState<string[]>(["Company", "Contact", "Role"]);

  useEffect(() => {
    const load = async () => {
      const result = await get<{ fields: string[] }>("/registration/config");
      if (result.data?.fields?.length) {
        setFields(result.data.fields);
      }
    };

    load();
  }, [get]);

  return (
    <Box>
      <PageHeader
        title="Registration"
        subtitle="Submit a dealer or vendor registration request for Komatsu APIs."
      />
      <Stack spacing={3}>
        <Grid container spacing={2}>
          {fields.map((field) => (
            <Grid item xs={12} md={6} key={field}>
              <TextField label={field} fullWidth />
            </Grid>
          ))}
          <Grid item xs={12}>
            <TextField label="Intended APIs" fullWidth />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Data usage details" fullWidth multiline minRows={4} />
          </Grid>
        </Grid>
        <Button
          variant="contained"
          onClick={() => post("/registration", { status: "submitted" })}
        >
          Submit registration
        </Button>
        <Typography color="text.secondary">
          Submissions trigger the Logic Apps workflow for approval.
        </Typography>
      </Stack>
    </Box>
  );
};

export default Register;
