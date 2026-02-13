import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { usePortalApi } from "../api/client";
import PageHeader from "../components/PageHeader";

type NewsItem = {
  id: string;
  title: string;
  date: string;
  tags?: string[];
};

const News = () => {
  const { get } = usePortalApi();
  const [items, setItems] = useState<NewsItem[]>([]);

  useEffect(() => {
    const load = async () => {
      const result = await get<NewsItem[]>("/news");
      if (result.data) {
        setItems(result.data);
      }
    };

    load();
  }, [get]);

  return (
    <Box>
      <PageHeader title="News and Announcements" subtitle="Latest updates from AEM." />
      <Stack spacing={2}>
        {items.length === 0 && (
          <Typography color="text.secondary">No news articles yet.</Typography>
        )}
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600}>
                {item.title}
              </Typography>
              <Typography color="text.secondary">{item.date}</Typography>
              {item.tags && (
                <Typography color="text.secondary">Tags: {item.tags.join(", ")}</Typography>
              )}
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
};

export default News;
