export type ApiSummary = {
  id: string;
  name: string;
  description: string;
  status: "Sandbox" | "Production" | "Deprecated";
  owner: string;
  tags: string[];
  category: string;
  plan: "Free" | "Paid" | "Internal";
};

export type ApiDetails = ApiSummary & {
  overview: string;
  documentationUrl: string;
  plans: Array<{ name: string; quota: string; notes: string }>;
};
