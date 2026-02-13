import {
  Box,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { usePortalApi } from "../api/client";
import { apiCatalog } from "../api/mockData";
import { ApiSummary } from "../api/types";
import ApiCard from "../components/ApiCard";
import PageHeader from "../components/PageHeader";
import { useToast } from "../components/useToast";

const ApiCatalog = () => {
  const { get } = usePortalApi();
  const toast = useToast();
  const [apis, setApis] = useState<ApiSummary[]>(apiCatalog);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [plan, setPlan] = useState("");

  useEffect(() => {
    const load = async () => {
      const result = await get<ApiSummary[]>(
        `/apis?search=${encodeURIComponent(search)}&category=${encodeURIComponent(
          category
        )}&plan=${encodeURIComponent(plan)}`
      );

      if (result.data) {
        setApis(result.data);
      } else if (result.error) {
        toast.notify("Using local catalog data until the portal API is ready.", "info");
      }
    };

    load();
  }, [get, search, category, plan, toast]);

  const filtered = useMemo(() => {
    return apis.filter((api) => {
      const matchesSearch = api.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category ? api.category === category : true;
      const matchesPlan = plan ? api.plan === plan : true;
      return matchesSearch && matchesCategory && matchesPlan;
    });
  }, [apis, search, category, plan]);

  return (
    <Box>
      <PageHeader
        title="API Catalog"
        subtitle="Search the Infosys APIM catalog and filter by category, environment, or plan."
      />
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} mb={3}>
        <TextField
          label="Search APIs"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          fullWidth
        />
        <TextField
          label="Category"
          select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="Warranty">Warranty</MenuItem>
          <MenuItem value="Equipment">Equipment</MenuItem>
          <MenuItem value="Commerce">Commerce</MenuItem>
        </TextField>
        <TextField
          label="Plan"
          select
          value={plan}
          onChange={(event) => setPlan(event.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="Free">Free</MenuItem>
          <MenuItem value="Paid">Paid</MenuItem>
          <MenuItem value="Internal">Internal</MenuItem>
        </TextField>
      </Stack>
      <Typography variant="subtitle2" color="text.secondary" mb={2}>
        {filtered.length} APIs available
      </Typography>
      <Grid container spacing={3}>
        {filtered.map((api) => (
          <Grid item xs={12} md={6} lg={4} key={api.id}>
            <ApiCard api={api} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default ApiCatalog;
