/* Repository for workspace calendar use cases. */
(() => {
  const transport = window.BCCWorkspaceTransport;
  const contracts = window.BCCWorkspaceCalendarContracts;

  async function run(operation) {
    try {
      return await operation();
    } catch (error) {
      throw contracts.toError(error);
    }
  }

  const repository = {
    list(options = {}) {
      return run(async () => contracts.events(await transport.request("/api/workspace/events", options)));
    },
    create(values, options = {}) {
      return run(async () => contracts.eventFrom(await transport.request("/api/workspace/events", {
        ...options,
        method: "POST",
        body: values
      })));
    },
    update(eventId, values, options = {}) {
      return run(async () => contracts.eventFrom(await transport.request(
        `/api/workspace/events/${encodeURIComponent(eventId)}`,
        { ...options, method: "PATCH", body: values }
      )));
    },
    remove(eventId, options = {}) {
      return run(() => transport.request(`/api/workspace/events/${encodeURIComponent(eventId)}`, {
        ...options,
        method: "DELETE"
      }));
    }
  };

  window.BCCWorkspaceCalendarRepository = Object.freeze(repository);
})();
