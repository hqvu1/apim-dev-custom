import { Box, CircularProgress, Typography } from "@mui/material";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useApimClient } from "../api/apimClient";
import PageHeader from "../components/PageHeader";
import { useTranslation } from "react-i18next";

const ApiTryIt = () => {
  const { apiId } = useParams();
  const { getApiById } = useApimClient();
  const { t } = useTranslation();
  const [specUrl, setSpecUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const details = await getApiById(apiId!);
      if (details?.openApiUrl) {
        setSpecUrl(details.openApiUrl);
        setDisplayName(details.displayName);
      }
      setLoading(false);
    };
    load();
  }, [apiId]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  if (!specUrl) {
    return (
      <Box>
        <PageHeader title={t("tryIt.title")} subtitle={t("tryIt.noSpec")} />
        <Typography color="text.secondary">
          {t("tryIt.contactOwner")}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={t("tryIt.titleWithName", { name: displayName })}
        subtitle={t("tryIt.subtitle")}
      />
      <Box
        sx={{
          "& .swagger-ui": { fontFamily: "inherit" },
          "& .swagger-ui .topbar": { display: "none" }, // hide Swagger logo bar
        }}
      >
        <SwaggerUI
          url={specUrl}
          tryItOutEnabled={true}
          requestInterceptor={(req) => {
            // Inject auth token automatically into Swagger Try-It requests
            const token = sessionStorage.getItem("msal.access.token");
            if (token) {
              req.headers["Authorization"] = `Bearer ${token}`;
            }
            return req;
          }}
        />
      </Box>
    </Box>
  );
};

export default ApiTryIt;