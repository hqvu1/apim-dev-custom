import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  alpha,
  useTheme
} from "@mui/material";
import {
  ArrowBack,
  HttpOutlined,
  LockOutlined,
  OpenInNew,
  PlayArrowOutlined
} from "@mui/icons-material";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { usePortalApi } from "../api/client";
import { ApiDetails as ApiDetailsType, ApiOperation } from "../api/types";
import PageHeader from "../components/PageHeader";
import SectionCard from "../components/SectionCard";
import { useToast } from "../components/useToast";

const METHOD_COLORS: Record<string, string> = {
  GET: "#61affe",
  POST: "#49cc90",
  PUT: "#fca130",
  DELETE: "#f93e3e",
  PATCH: "#50e3c2",
  HEAD: "#9012fe",
  OPTIONS: "#0d5aa7"
};

const MethodBadge = ({ method }: { method: string }) => {
  const m = method.toUpperCase();
  const bg = METHOD_COLORS[m] ?? "#999";
  return (
    <Chip
      label={m}
      size="small"
      sx={{
        bgcolor: bg,
        color: "#fff",
        fontWeight: 700,
        fontFamily: "monospace",
        fontSize: "0.7rem",
        minWidth: 62,
        borderRadius: 1
      }}
    />
  );
};

const ApiDetails = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { apiId } = useParams();
  const { get, post } = usePortalApi();
  const toast = useToast();
  const [details, setDetails] = useState<ApiDetailsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subStatus, setSubStatus] = useState<string>("Not subscribed");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [detailsResult, subResult] = await Promise.all([
          get<ApiDetailsType>(`/apis/${apiId}`),
          get<{ status: string }>(`/apis/${apiId}/subscription`)
        ]);

        if (cancelled) return;

        if (detailsResult.data) {
          setDetails(detailsResult.data);
        } else {
          setError("API not found.");
        }

        if (subResult.data) {
          setSubStatus(subResult.data.status);
        }
      } catch {
        if (!cancelled) setError("Failed to load API details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [apiId, get, toast]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !details) {
    return (
      <Box py={4}>
        <Alert severity="error">{error ?? "API not found."}</Alert>
        <Button startIcon={<ArrowBack />} onClick={() => navigate("/apis")} sx={{ mt: 2 }}>
          Back to catalog
        </Button>
      </Box>
    );
  }

  const operations: ApiOperation[] = details.operations ?? [];
  const plans = details.plans ?? [];

  return (
    <Box>
      {/* Back button */}
      <Button startIcon={<ArrowBack />} onClick={() => navigate("/apis")} sx={{ mb: 2 }}>
        Back to catalog
      </Button>

      <PageHeader title={details.name} subtitle={details.description || undefined} />

      {/* Metadata row */}
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={3}>
        <Chip
          label={details.status}
          size="small"
          color={
            (() => {
              if (details.status === "Production") return "success";
              if (details.status === "Deprecated") return "error";
              return "warning";
            })()
          }
        />
        <Chip label={details.plan} size="small" variant="outlined" />
        {details.category && <Chip label={details.category} size="small" variant="outlined" />}
        {details.subscriptionRequired && (
          <Chip icon={<LockOutlined sx={{ fontSize: 14 }} />} label="Subscription required" size="small" variant="outlined" color="warning" />
        )}
        {details.protocols && details.protocols.length > 0 && (
          <Chip icon={<HttpOutlined sx={{ fontSize: 14 }} />} label={details.protocols.join(", ").toUpperCase()} size="small" variant="outlined" />
        )}
        {details.path && (
          <Chip
            label={`/${details.path}`}
            size="small"
            sx={{ fontFamily: "monospace", bgcolor: alpha(theme.palette.primary.main, 0.06), color: theme.palette.primary.main }}
          />
        )}
        {details.apiVersion && (
          <Chip label={`v${details.apiVersion}`} size="small" variant="outlined" />
        )}
      </Stack>

      <Grid container spacing={3}>
        {/* Left column – Overview + Operations */}
        <Grid item xs={12} lg={8}>
          {/* Overview */}
          <SectionCard title="Overview">
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              {details.overview || details.description || "No description available for this API."}
            </Typography>
            {details.documentationUrl && (
              <Button
                component="a"
                href={details.documentationUrl}
                target="_blank"
                rel="noopener"
                variant="outlined"
                size="small"
                startIcon={<OpenInNew />}
              >
                View documentation
              </Button>
            )}
            {details.openApiUrl && (
              <Button
                component="a"
                href={`/api${details.openApiUrl}`}
                target="_blank"
                rel="noopener"
                variant="outlined"
                size="small"
                startIcon={<OpenInNew />}
                sx={{ ml: 1 }}
              >
                Export OpenAPI spec
              </Button>
            )}
          </SectionCard>

          {/* Operations */}
          {operations.length > 0 && (
            <Box mt={3}>
              <SectionCard title={`Operations (${operations.length})`}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Method</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Endpoint</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {operations.map((op) => (
                        <TableRow key={op.id} hover>
                          <TableCell sx={{ width: 80 }}>
                            <MethodBadge method={op.method} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace" noWrap>
                              {op.urlTemplate}
                            </Typography>
                            {op.displayName && op.displayName !== op.name && (
                              <Typography variant="caption" color="text.secondary">
                                {op.displayName}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300 }}>
                              {op.description || "—"}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </SectionCard>
            </Box>
          )}

          {/* Contact / License */}
          {(details.contact || details.license) && (
            <Box mt={3}>
              <SectionCard title="Additional Information">
                {details.contact && (
                  <Box mb={1}>
                    <Typography variant="subtitle2" fontWeight={600}>Contact</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {details.contact.name ?? "—"}{details.contact.email ? ` · ${details.contact.email}` : ""}
                      {details.contact.url && (
                        <> · <a href={details.contact.url} target="_blank" rel="noopener">{details.contact.url}</a></>
                      )}
                    </Typography>
                  </Box>
                )}
                {details.license && (
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600}>License</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {details.license.name ?? "Unknown"}
                      {details.license.url && (
                        <> · <a href={details.license.url} target="_blank" rel="noopener">View license</a></>
                      )}
                    </Typography>
                  </Box>
                )}
              </SectionCard>
            </Box>
          )}
        </Grid>

        {/* Right column – Subscription + Plans + Try-It */}
        <Grid item xs={12} lg={4}>
          {/* Subscription */}
          <SectionCard title="Subscription">
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Status: <strong>{subStatus}</strong>
            </Typography>
            <Button
              variant="contained"
              fullWidth
              onClick={() => post(`/apis/${apiId}/subscriptions`, { action: "request" })}
            >
              Request access
            </Button>
          </SectionCard>

          {/* Try-It */}
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Test this API
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Use the interactive console to send requests and view responses in real time.
              </Typography>
              <Button
                variant="outlined"
                fullWidth
                component={Link}
                to={`/apis/${apiId}/try`}
                startIcon={<PlayArrowOutlined />}
              >
                Open Try-It Console
              </Button>
            </CardContent>
          </Card>

          {/* Plans */}
          {plans.length > 0 && (
            <Box mt={2}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Available Plans
              </Typography>
              <Divider sx={{ mb: 1 }} />
              <Stack spacing={1}>
                {plans.map((plan) => (
                  <Card key={plan.name} variant="outlined">
                    <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {plan.name}
                      </Typography>
                      {plan.quota && (
                        <Typography variant="caption" color="text.secondary">
                          Quota: {plan.quota}
                        </Typography>
                      )}
                      {plan.notes && (
                        <Typography variant="body2" color="text.secondary">
                          {plan.notes}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

export default ApiDetails;
