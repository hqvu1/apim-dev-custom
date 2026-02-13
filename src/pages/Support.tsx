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
import { usePortalApi } from "../api/client";
import PageHeader from "../components/PageHeader";

type Ticket = {
  id: string;
  subject: string;
  status: string;
};

const Support = () => {
  const { get, post } = usePortalApi();
  const [tab, setTab] = useState(0);
  const [faqs, setFaqs] = useState<string[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    const load = async () => {
      const [faqResult, ticketResult] = await Promise.all([
        get<string[]>("/support/faqs"),
        get<Ticket[]>("/support/my-tickets")
      ]);

      if (faqResult.data) {
        setFaqs(faqResult.data);
      }

      if (ticketResult.data) {
        setTickets(ticketResult.data);
      }
    };

    load();
  }, [get]);

  return (
    <Box>
      <PageHeader title="Support" subtitle="FAQs, ticket creation, and service history." />
      <Tabs value={tab} onChange={(_, next) => setTab(next)} sx={{ mb: 3 }}>
        <Tab label="FAQs" />
        <Tab label="Create Ticket" />
        <Tab label="My Tickets" />
      </Tabs>
      {tab === 0 && (
        <Card>
          <CardContent>
            {faqs.length === 0 ? (
              <Typography color="text.secondary">No FAQs loaded.</Typography>
            ) : (
              faqs.map((faq) => <Typography key={faq}>{faq}</Typography>)
            )}
          </CardContent>
        </Card>
      )}
      {tab === 1 && (
        <Card>
          <CardContent>
            <TextField label="Category" fullWidth sx={{ mb: 2 }} />
            <TextField label="API" fullWidth sx={{ mb: 2 }} />
            <TextField label="Impact" fullWidth sx={{ mb: 2 }} />
            <TextField label="Description" fullWidth multiline minRows={4} sx={{ mb: 2 }} />
            <Button variant="contained" onClick={() => post("/support/tickets", {})}>
              Submit ticket
            </Button>
          </CardContent>
        </Card>
      )}
      {tab === 2 && (
        <Card>
          <CardContent>
            {tickets.length === 0 ? (
              <Typography color="text.secondary">No tickets yet.</Typography>
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
