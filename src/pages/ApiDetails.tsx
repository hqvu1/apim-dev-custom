import {
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  Stack,
  Typography
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { usePortalApi } from "../api/client";
import { apiDetail } from "../api/mockData";
import { ApiDetails as ApiDetailsType } from "../api/types";
import PageHeader from "../components/PageHeader";
import SectionCard from "../components/SectionCard";
import { useToast } from "../components/useToast";

const ApiDetails = () => {
  const { apiId } = useParams();
  const { get, post } = usePortalApi();
  const toast = useToast();
  const [details, setDetails] = useState<ApiDetailsType | null>(null);
  const [status, setStatus] = useState<string>("Not subscribed");

  useEffect(() => {
    const load = async () => {
      const [detailsResult, subscriptionResult] = await Promise.all([
        get<ApiDetailsType>(`/apis/${apiId}`),
        get<{ status: string }>(`/apis/${apiId}/subscription`)
      ]);

      if (detailsResult.data) {
        setDetails(detailsResult.data);
      } else {
        setDetails(apiDetail);
        toast.notify("Using local API details until the portal API is ready.", "info");
      }

      if (subscriptionResult.data) {
        setStatus(subscriptionResult.data.status);
      }
    };

    load();
  }, [apiId, get, toast]);

  if (!details) {
    return <Typography>Loading API details...</Typography>;
  }

  return (
    <Box>
      <PageHeader title={details.name} subtitle={details.description} />
      <Stack direction="row" spacing={1} mb={2}>
        <Chip label={details.status} />
        <Chip label={details.plan} />
        <Chip label={details.category} />
      </Stack>
      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <SectionCard title="Overview">
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              {details.overview}
            </Typography>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Documentation
            </Typography>
            <Button component={Link} to={details.documentationUrl} variant="outlined">
              Open OpenAPI or docs
            </Button>
          </SectionCard>
        </Grid>
        <Grid item xs={12} lg={4}>
          <SectionCard title="Subscription">
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Current status: {status}
            </Typography>
            <Button
              variant="contained"
              onClick={() => post(`/apis/${apiId}/subscriptions`, { action: "request" })}
            >
              Request access
            </Button>
          </SectionCard>
        </Grid>
      </Grid>
      <Box mt={3}>
        <Typography variant="h6" gutterBottom>
          Plans and quotas
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {details.plans.map((plan) => (
            <Grid item xs={12} md={6} key={plan.name}>
              <SectionCard title={plan.name}>
                <Typography color="text.secondary">Quota: {plan.quota}</Typography>
                <Typography color="text.secondary">{plan.notes}</Typography>
              </SectionCard>
            </Grid>
          ))}
        </Grid>
        <Box mt={3}>
          <Button variant="outlined" component={Link} to={`/apis/${apiId}/try`}>
            Open Try-It Console
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default ApiDetails;
