import { Card, CardContent, Typography } from "@mui/material";

const StatCard = ({ label, value }: { label: string; value: string }) => {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="overline" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h5" fontWeight={600}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default StatCard;
