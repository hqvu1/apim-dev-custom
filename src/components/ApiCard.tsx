import {
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Stack,
  Typography,
  alpha,
  useTheme
} from "@mui/material";
import {
  HttpOutlined,
  LockOutlined,
  LockOpenOutlined
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { ApiSummary } from "../api/types";

const statusColor: Record<string, "success" | "warning" | "default" | "error"> = {
  Production: "success",
  Sandbox: "warning",
  Deprecated: "error"
};

const ApiCard = ({ api }: { api: ApiSummary }) => {
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <Card
      sx={{
        height: "100%",
        transition: "all 0.2s ease",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: theme.shadows[4],
          borderColor: theme.palette.primary.main
        }
      }}
      variant="outlined"
    >
      <CardActionArea
        onClick={() => navigate(`/apis/${api.id}`)}
        sx={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "stretch" }}
      >
        <CardContent sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Header row: name + version badge */}
          <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
            <HttpOutlined fontSize="small" color="primary" />
            <Typography variant="h6" fontWeight={600} noWrap sx={{ flex: 1 }}>
              {api.name}
            </Typography>
            {api.apiVersion && (
              <Chip label={api.apiVersion} size="small" variant="outlined" sx={{ fontWeight: 600, fontSize: "0.7rem" }} />
            )}
          </Stack>

          {/* Path */}
          {api.path && (
            <Typography
              variant="caption"
              sx={{
                fontFamily: "monospace",
                color: theme.palette.primary.main,
                bgcolor: alpha(theme.palette.primary.main, 0.06),
                px: 1,
                py: 0.25,
                borderRadius: 1,
                display: "inline-block",
                mb: 1,
                width: "fit-content"
              }}
            >
              /{api.path}
            </Typography>
          )}

          {/* Description */}
          <Typography
            color="text.secondary"
            variant="body2"
            sx={{
              mb: 2,
              flex: 1,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden"
            }}
          >
            {api.description || "No description available."}
          </Typography>

          {/* Tags row */}
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: "auto" }}>
            <Chip
              label={api.status}
              size="small"
              color={statusColor[api.status] ?? "default"}
              sx={{ fontWeight: 500 }}
            />
            <Chip
              label={api.plan}
              size="small"
              variant="outlined"
              sx={{ fontWeight: 500 }}
            />
            {api.subscriptionRequired ? (
              <Chip
                icon={<LockOutlined sx={{ fontSize: 14 }} />}
                label="Key required"
                size="small"
                variant="outlined"
                color="warning"
              />
            ) : (
              <Chip
                icon={<LockOpenOutlined sx={{ fontSize: 14 }} />}
                label="Open"
                size="small"
                variant="outlined"
                color="success"
              />
            )}
            {api.protocols && api.protocols.length > 0 && (
              <Chip
                label={api.protocols.join(", ").toUpperCase()}
                size="small"
                variant="outlined"
                sx={{ fontFamily: "monospace", fontSize: "0.65rem" }}
              />
            )}
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default ApiCard;
