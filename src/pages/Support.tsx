import {
  Box,
  Button,
  Card,
  CardContent,
  Tab,
  Tabs,
  TextField,
  Typography
} from "@mui/material";
import { useEffect, useState } from "react";
import { usePortalApi, unwrapArray } from "../api/client";
import PageHeader from "../components/PageHeader";
import { useTranslation } from "react-i18next";

type Ticket = {
  id: string;
  subject: string;
  status: string;
};

const Support = () => {
  const { get, post } = usePortalApi();
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);
  const [faqs, setFaqs] = useState<string[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    const load = async () => {
      const [faqResult, ticketResult] = await Promise.all([
        get<string[]>("/support/faqs"),
        get<Ticket[]>("/support/my-tickets")
      ]);
      
      const faqItems = unwrapArray<string>(faqResult.data);
      if (faqItems) {
        setFaqs(faqItems);
      }
      const ticketItems = unwrapArray<Ticket>(ticketResult.data);
      if (ticketItems) {
        setTickets(ticketItems);
      }
    };

    load();
  }, [get]);

  return (
    <Box>
      <PageHeader title={t("support.title")} subtitle={t("support.subtitle")} />
      <Tabs value={tab} onChange={(_, next) => setTab(next)} sx={{ mb: 3 }}>
        <Tab label={t("support.tabFaqs")} />
        <Tab label={t("support.tabCreateTicket")} />
        <Tab label={t("support.tabMyTickets")} />
      </Tabs>
      {tab === 0 && (
        <Card>
          <CardContent>
            {faqs.length === 0 ? (
              <Typography color="text.secondary">{t("support.faqsEmpty")}</Typography>
            ) : (
              faqs.map((faq) => <Typography key={faq}>{faq}</Typography>)
            )}
          </CardContent>
        </Card>
      )}
      {tab === 1 && (
        <Card>
          <CardContent>
            <TextField label={t("support.categoryLabel")} fullWidth sx={{ mb: 2 }} />
            <TextField label={t("support.apiLabel")} fullWidth sx={{ mb: 2 }} />
            <TextField label={t("support.impactLabel")} fullWidth sx={{ mb: 2 }} />
            <TextField label={t("support.descriptionLabel")} fullWidth multiline minRows={4} sx={{ mb: 2 }} />
            <Button variant="contained" onClick={() => post("/support/tickets", {})}>
              {t("support.submitTicket")}
            </Button>
          </CardContent>
        </Card>
      )}
      {tab === 2 && (
        <Card>
          <CardContent>
            {tickets.length === 0 ? (
              <Typography color="text.secondary">{t("support.ticketsEmpty")}</Typography>
            ) : (
              tickets.map((ticket) => (
                <Box key={ticket.id} mb={2}>
                  <Typography fontWeight={600}>{ticket.subject}</Typography>
                  <Typography color="text.secondary">{ticket.status}</Typography>
                </Box>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default Support;
