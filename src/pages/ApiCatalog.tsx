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
import { usePortalApi, unwrapArray } from "../api/client";
import { apiCatalog } from "../api/mockData";
import { ApiSummary } from "../api/types";
import ApiCard from "../components/ApiCard";
import PageHeader from "../components/PageHeader";
import { useToast } from "../components/useToast";
import { useTranslation } from "react-i18next";

const ApiCatalog = () => {
  const { get } = usePortalApi();
  const toast = useToast();
  const { t } = useTranslation();
  const [apis, setApis] = useState<ApiSummary[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [plan, setPlan] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const result = await get<ApiSummary[] | { value: ApiSummary[] }>("/apis");

      if (cancelled) return;

      const items = unwrapArray<ApiSummary>(result.data);
      if (items) {
        setApis(items);
      } else if (result.error) {
        setApis(apiCatalog);
        toast.notify(t("apis.toast.localData"), "info");
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
        title={t("apis.title")}
        subtitle={t("apis.subtitle")}
      />

      {/* Search and filter bar */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} mb={3}>
        <TextField
          placeholder={t("apis.searchPlaceholder")}
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
          label={t("apis.categoryLabel")}
          select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          sx={{ minWidth: 180 }}
          size="small"
        >
          <MenuItem value="">{t("apis.allCategories")}</MenuItem>
          {categories.map((c) => (
            <MenuItem key={c} value={c}>{c}</MenuItem>
          ))}
        </TextField>
        <TextField
          label={t("apis.planLabel")}
          select
          value={plan}
          onChange={(event) => setPlan(event.target.value)}
          sx={{ minWidth: 160 }}
          size="small"
        >
          <MenuItem value="">{t("apis.allPlans")}</MenuItem>
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
              label={t("apis.filterCategory", { value: category })}
              size="small"
              onDelete={() => setCategory("")}
            />
          )}
          {plan && (
            <Chip
              label={t("apis.filterPlan", { value: plan })}
              size="small"
              onDelete={() => setPlan("")}
            />
          )}
        </Stack>
      )}

      {/* Results count */}
      {!loading && (
        <Typography variant="subtitle2" color="text.secondary" mb={2}>
          {filtered.length === 1 ? t("apis.resultCountSingular", { count: filtered.length }) : t("apis.resultCount", { count: filtered.length })}
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
            {t("apis.emptyTitle")}
          </Typography>
          <Typography color="text.secondary">
            {search || category || plan
              ? t("apis.emptyFilterHint")
              : t("apis.emptyNoData")}
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
