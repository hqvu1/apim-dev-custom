import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography
} from "@mui/material";
import { useEffect, useState } from "react";
import { usePortalApi, unwrapArray } from "../api/client";
import PageHeader from "../components/PageHeader";
import { useTranslation } from "react-i18next";

type Subscription = {
  apiName: string;
  environment: string;
  status: string;
  quota: string;
};

const MyIntegrations = () => {
  const { get } = usePortalApi();
  const { t } = useTranslation();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  useEffect(() => {
    const load = async () => {
      const result = await get<Subscription[]>("/users/me/subscriptions");
      const items = unwrapArray<Subscription>(result.data);
      if (items) {
        setSubscriptions(items);
      }
    };

    load();
  }, [get]);

  return (
    <Box>
      <PageHeader
        title={t("integrations.title")}
        subtitle={t("integrations.subtitle")}
      />
      <Stack spacing={2}>
        {subscriptions.length === 0 && (
          <Typography color="text.secondary">{t("integrations.empty")}</Typography>
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
                <Typography color="text.secondary">{t("integrations.quotaLabel")} {item.quota}</Typography>
                <Button variant="outlined">{t("integrations.manage")}</Button>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
};

export default MyIntegrations;
