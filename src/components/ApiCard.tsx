import { Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { ApiSummary } from "../api/types";

const ApiCard = ({ api }: { api: ApiSummary }) => {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent component={Link} to={`/apis/${api.id}`}>
        <Typography variant="h6" gutterBottom>
          {api.name}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {api.description}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip label={api.status} size="small" />
          <Chip label={api.plan} size="small" />
          <Chip label={api.category} size="small" />
        </Stack>
      </CardContent>
    </Card>
  );
};

export default ApiCard;
