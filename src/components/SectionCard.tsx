import { Card, CardContent, Typography } from "@mui/material";

const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }) => {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
};

export default SectionCard;
