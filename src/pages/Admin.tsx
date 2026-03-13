import { Box, Button, Card, CardContent, Grid, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { usePortalApi, unwrapArray } from "../api/client";
import PageHeader from "../components/PageHeader";
import { useTranslation } from "react-i18next";

type RegistrationRequest = {
  id: string;
  company: string;
  region: string;
};

type Metric = {
  label: string;
  value: string;
};

const Admin = () => {
  const { get, post } = usePortalApi();
  const { t } = useTranslation();
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);

  useEffect(() => {
    const load = async () => {
      const [requestsResult, metricsResult] = await Promise.all([
        get<RegistrationRequest[]>("/admin/registrations?status=pending"),
        get<Metric[]>("/admin/metrics")
      ]);

      const items = unwrapArray<RegistrationRequest>(requestsResult.data);
      if (items) {
        setRequests(items);
      }

      const metricsItems = unwrapArray<Metric>(metricsResult.data);
      if (metricsItems) {
        setMetrics(metricsItems);
      }
    };

    load();
  }, [get]);

  return (
    <Box>
      <PageHeader
        title={t("admin.title")}
        subtitle={t("admin.subtitle")}
      />
      <Grid container spacing={3} mb={3}>
        {metrics.map((metric) => (
          <Grid item xs={12} md={4} key={metric.label}>
            <Card>
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  {metric.label}
                </Typography>
                <Typography variant="h5" fontWeight={600}>
                  {metric.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Typography variant="h6" gutterBottom>
        {t("admin.pendingRegistrations")}
      </Typography>
      <Stack spacing={2}>
        {requests.map((request) => (
          <Card key={request.id}>
            <CardContent>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
                <Box flex={1}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {request.company}
                  </Typography>
                  <Typography color="text.secondary">{t("admin.regionLabel")} {request.region}</Typography>
                </Box>
                <Button
                  variant="contained"
                  onClick={() => post(`/admin/registrations/${request.id}/approve`, {})}
                >
                  {t("admin.approve")}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => post(`/admin/registrations/${request.id}/reject`, {})}
                >
                  {t("admin.reject")}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
};

export default Admin;
