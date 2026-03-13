import { Box, Card, CardContent, Step, StepLabel, Stepper, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { usePortalApi } from "../api/client";
import PageHeader from "../components/PageHeader";
import { useTranslation } from "react-i18next";

const stepKeys = ["onboarding.steps.submitted", "onboarding.steps.underReview", "onboarding.steps.approved", "onboarding.steps.accessEnabled"] as const;
const stepStatuses = ["Submitted", "Under Review", "Approved", "Access Enabled"];

const Onboarding = () => {
  const { get } = usePortalApi();
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState(1);

  useEffect(() => {
    const load = async () => {
      const result = await get<{ status: string }>("/registration/status");
      if (result.data?.status) {
        const index = stepStatuses.findIndex((step) => step === result.data?.status);
        setActiveStep(index >= 0 ? index : 1);
      }
    };

    load();
  }, [get]);

  return (
    <Box>
      <PageHeader
        title={t("onboarding.title")}
        subtitle={t("onboarding.subtitle")}
      />
      <Card>
        <CardContent>
          <Stepper activeStep={activeStep} alternativeLabel>
            {stepKeys.map((key) => (
              <Step key={key}>
                <StepLabel>{t(key)}</StepLabel>
              </Step>
            ))}
          </Stepper>
          <Typography color="text.secondary" sx={{ mt: 3 }}>
            {t("onboarding.currentStatus")} {t(stepKeys[activeStep])}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Onboarding;
