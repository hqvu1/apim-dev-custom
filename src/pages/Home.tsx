import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  Typography
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePortalApi } from "../api/client";
import { apiHighlights } from "../api/mockData";
import { ApiSummary } from "../api/types";
import PageHeader from "../components/PageHeader";
import SectionCard from "../components/SectionCard";
import StatCard from "../components/StatCard";
import { useToast } from "../components/useToast";

const Home = () => {
  const navigate = useNavigate();
  const { get } = usePortalApi();
  const toast = useToast();
  const [highlights, setHighlights] = useState<ApiSummary[]>(apiHighlights);
  const [news, setNews] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [newsResult, highlightsResult] = await Promise.all([
        get<{ title: string }[]>("/news"),
        get<ApiSummary[]>("/apis/highlights")
      ]);

      if (newsResult.data) {
        setNews(newsResult.data.map((item) => item.title));
      }

      if (highlightsResult.data) {
        setHighlights(highlightsResult.data);
      }

      if (newsResult.error || highlightsResult.error) {
        toast.notify("Using local highlight data until the portal API is ready.", "info");
      }

      setLoading(false);
    };

    load();
  }, [get, toast]);

  return (
    <Box>
      <PageHeader
        title="Welcome to the Komatsu API Marketplace"
        subtitle="Discover secure, role-aware APIs from Infosys APIM customization on Azure and manage your integrations in one place."
      />
      <Grid container spacing={3} mb={2}>
        <Grid item xs={12} md={4}>
          <StatCard label="Active APIs" value="42" />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard label="My Integrations" value="6" />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard label="Open Tickets" value="2" />
        </Grid>
      </Grid>
      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                Featured APIs
              </Typography>
              <Stack spacing={2}>
                {loading && <Typography color="text.secondary">Loading highlights...</Typography>}
                {!loading &&
                  highlights.map((api) => (
                    <Stack key={api.id} direction="row" spacing={2} alignItems="center">
                      <Box flex={1}>
                        <Typography fontWeight={600}>{api.name}</Typography>
                        <Typography color="text.secondary">{api.description}</Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Chip label={api.status} size="small" />
                        <Chip label={api.plan} size="small" />
                      </Stack>
                      <Button variant="contained" onClick={() => navigate(`/apis/${api.id}`)}>
                        View details
                      </Button>
                    </Stack>
                  ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={4}>
          <SectionCard title="What is new">
            <Stack spacing={1}>
              {news.length === 0 && (
                <Typography color="text.secondary">No announcements yet.</Typography>
              )}
              {news.map((item) => (
                <Typography key={item}>{item}</Typography>
              ))}
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>
      <Grid container spacing={3} mt={1}>
        <Grid item xs={12} md={4}>
          <SectionCard title="Browse APIs">
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Search Infosys APIM catalog and filter by plan or environment.
            </Typography>
            <Button variant="outlined" onClick={() => navigate("/apis")}>Browse</Button>
          </SectionCard>
        </Grid>
        <Grid item xs={12} md={4}>
          <SectionCard title="My Integrations">
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Track subscriptions, keys, and quotas across environments.
            </Typography>
            <Button variant="outlined" onClick={() => navigate("/my/integrations")}>Open</Button>
          </SectionCard>
        </Grid>
        <Grid item xs={12} md={4}>
          <SectionCard title="Support">
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Submit issues, browse FAQs, and view ticket status.
            </Typography>
            <Button variant="outlined" onClick={() => navigate("/support")}>Get help</Button>
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Home;
