import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography
} from "@mui/material";
import { useEffect, useState } from "react";
import { usePortalApi } from "../api/client";
import PageHeader from "../components/PageHeader";

type Subscription = {
  apiName: string;
  environment: string;
  status: string;
  quota: string;
};

const MyIntegrations = () => {
  const { get } = usePortalApi();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  useEffect(() => {
    const load = async () => {
      const result = await get<Subscription[]>("/users/me/subscriptions");
      if (result.data) {
        setSubscriptions(result.data);
      }
    };

    load();
  }, [get]);

  return (
    <Box>
      <PageHeader
        title="My Integrations"
        subtitle="Subscriptions, credentials, and quota usage across your APIs."
      />
      <Stack spacing={2}>
        {subscriptions.length === 0 && (
          <Typography color="text.secondary">No subscriptions yet.</Typography>
        )}
        {subscriptions.map((item) => (
          <Card key={item.apiName}>
            <CardContent>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
                <Box flex={1}>
                  <Typography variant="h6">{item.apiName}</Typography>
                  <Typography color="text.secondary">
                    {item.environment} | {item.status}
                  </Typography>
                </Box>
                <Typography color="text.secondary">Quota: {item.quota}</Typography>
                <Button variant="outlined">Manage</Button>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
};

export default MyIntegrations;
