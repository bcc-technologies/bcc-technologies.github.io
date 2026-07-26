/* Repository for workspace form use cases. */
(() => {
  const transport = window.BCCWorkspaceTransport;
  const contracts = window.BCCWorkspaceFormContracts;

  async function run(operation) {
    try {
      return await operation();
    } catch (error) {
      throw contracts.toError(error);
    }
  }

  const repository = {
    list(options = {}) {
      return run(async () => contracts.forms(await transport.request("/api/workspace/forms", options)));
    },
    listMine(options = {}) {
      return run(async () => contracts.responses(await transport.request("/api/workspace/form-responses/me", options)));
    },
    create(values, options = {}) {
      return run(async () => contracts.formFrom(await transport.request("/api/workspace/forms", {
        ...options,
        method: "POST",
        body: values
      })));
    },
    update(formId, values, options = {}) {
      return run(async () => contracts.formFrom(await transport.request(
        `/api/workspace/forms/${encodeURIComponent(formId)}`,
        { ...options, method: "PATCH", body: values }
      )));
    },
    listResponses(formId, options = {}) {
      return run(async () => contracts.responses(await transport.request(
        `/api/workspace/forms/${encodeURIComponent(formId)}/responses`,
        options
      )));
    },
    submit(formId, answers, options = {}) {
      return run(async () => contracts.responseFrom(await transport.request(
        `/api/workspace/forms/${encodeURIComponent(formId)}/response`,
        { ...options, method: "POST", body: { answers } }
      )));
    }
  };

  window.BCCWorkspaceFormRepository = Object.freeze(repository);
})();
