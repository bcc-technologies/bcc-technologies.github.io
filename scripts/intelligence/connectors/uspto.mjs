const usptoConnector = {
  sourceName: "USPTO",
  sourceType: "uspto",
  baseUrl: "https://data.uspto.gov",
  requiresApiKey: true,
  supportsActions: ["fetch_patents"],
  itemKind: "patent",
  defaultEnabled: false,
  enforcedDisabled: true,
  rateLimitNotes: "USPTO ODP access is currently kept inactive because the available API credential flow is restricted for this deployment context. Leave disabled until BCC has an approved credential path.",
  async search() {
    throw new Error("USPTO connector is intentionally inactive in this deployment because official API access is not currently available to this workspace.");
  },
  async fetchById() {
    throw new Error("USPTO connector is intentionally inactive in this deployment because official API access is not currently available to this workspace.");
  }
};

export default usptoConnector;
export const uspto = usptoConnector;
