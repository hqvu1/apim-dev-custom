import { Box, Button, Grid, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { usePortalApi } from "../api/client";
import PageHeader from "../components/PageHeader";
import { useTranslation } from "react-i18next";

const Register = () => {
  const { get, post } = usePortalApi();
  const { t } = useTranslation();
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
        title={t("register.title")}
        subtitle={t("register.subtitle")}
      />
      <Stack spacing={3}>
        <Grid container spacing={2}>
          {fields.map((field) => (
            <Grid item xs={12} md={6} key={field}>
              <TextField label={field} fullWidth />
            </Grid>
          ))}
          <Grid item xs={12}>
            <TextField label={t("register.intendedApis")} fullWidth />
          </Grid>
          <Grid item xs={12}>
            <TextField label={t("register.dataUsage")} fullWidth multiline minRows={4} />
          </Grid>
        </Grid>
        <Button
          variant="contained"
          onClick={() => post("/registration", { status: "submitted" })}
        >
          {t("register.submit")}
        </Button>
        <Typography color="text.secondary">
          {t("register.approvalNote")}
        </Typography>
      </Stack>
    </Box>
  );
};

export default Register;
