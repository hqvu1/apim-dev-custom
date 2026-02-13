import { Box, Card, CardContent, Step, StepLabel, Stepper, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { usePortalApi } from "../api/client";
import PageHeader from "../components/PageHeader";

const steps = ["Submitted", "Under Review", "Approved", "Access Enabled"];

const Onboarding = () => {
  const { get } = usePortalApi();
  const [activeStep, setActiveStep] = useState(1);

  useEffect(() => {
    const load = async () => {
      const result = await get<{ status: string }>("/registration/status");
      if (result.data?.status) {
        const index = steps.findIndex((step) => step === result.data?.status);
        setActiveStep(index >= 0 ? index : 1);
      }
    };

    load();
  }, [get]);

  return (
    <Box>
      <PageHeader
        title="Onboarding Status"
        subtitle="Track your dealer or vendor onboarding request." 
      />
      <Card>
        <CardContent>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
          <Typography color="text.secondary" sx={{ mt: 3 }}>
            Current status: {steps[activeStep]}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Onboarding;
