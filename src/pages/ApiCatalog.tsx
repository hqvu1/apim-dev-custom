import {
  Box,
  Chip,
  CircularProgress,
  Grid,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
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
  const [apis, setApis] = useState<ApiSummary[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [plan, setPlan] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const result = await get<ApiSummary[]>("/apis");

      if (cancelled) return;

      if (result.data && Array.isArray(result.data)) {
        setApis(result.data);
      } else if (result.error) {
        setApis(apiCatalog);
        toast.notify("Using local catalog data until the portal API is ready.", "info");
      }
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [get, toast]);

  // Dynamically compute unique categories and plans from the data
  const categories = useMemo(() => {
    const set = new Set(apis.map((a) => a.category).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [apis]);

  const plans = useMemo(() => {
    const set = new Set(apis.map((a) => a.plan).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [apis]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return apis.filter((api) => {
      const matchesSearch =
        !q ||
        api.name.toLowerCase().includes(q) ||
        (api.description || "").toLowerCase().includes(q) ||
        (api.path || "").toLowerCase().includes(q);
      const matchesCategory = category ? api.category === category : true;
      const matchesPlan = plan ? api.plan === plan : true;
      return matchesSearch && matchesCategory && matchesPlan;
    });
  }, [apis, search, category, plan]);

  return (
    <Box>
      <PageHeader
        title="API Catalog"
        subtitle="Discover and explore APIs available on the Komatsu API Management platform."
      />

      {/* Search and filter bar */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} mb={3}>
        <TextField
          placeholder="Search by name, description, or path..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          fullWidth
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            )
          }}
        />
        <TextField
          label="Category"
          select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          sx={{ minWidth: 180 }}
          size="small"
        >
          <MenuItem value="">All Categories</MenuItem>
          {categories.map((c) => (
            <MenuItem key={c} value={c}>{c}</MenuItem>
          ))}
        </TextField>
        <TextField
          label="Plan"
          select
          value={plan}
          onChange={(event) => setPlan(event.target.value)}
          sx={{ minWidth: 160 }}
          size="small"
        >
          <MenuItem value="">All Plans</MenuItem>
          {plans.map((p) => (
            <MenuItem key={p} value={p}>{p}</MenuItem>
          ))}
        </TextField>
      </Stack>

      {/* Active filters */}
      {(category || plan) && (
        <Stack direction="row" spacing={1} mb={2}>
          {category && (
            <Chip
              label={`Category: ${category}`}
              size="small"
              onDelete={() => setCategory("")}
            />
          )}
          {plan && (
            <Chip
              label={`Plan: ${plan}`}
              size="small"
              onDelete={() => setPlan("")}
            />
          )}
        </Stack>
      )}

      {/* Results count */}
      {!loading && (
        <Typography variant="subtitle2" color="text.secondary" mb={2}>
          {filtered.length} {filtered.length === 1 ? "API" : "APIs"} available
        </Typography>
      )}

      {/* Loading state */}
      {loading && (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <Box textAlign="center" py={6}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No APIs found
          </Typography>
          <Typography color="text.secondary">
            {search || category || plan
              ? "Try adjusting your search or filter criteria."
              : "No APIs are currently published."}
          </Typography>
        </Box>
      )}

      {/* API Grid */}
      {!loading && filtered.length > 0 && (
        <Grid container spacing={3}>
          {filtered.map((api) => (
            <Grid item xs={12} md={6} lg={4} key={api.id}>
              <ApiCard api={api} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default ApiCatalog;
