/* Repository for workspace task use cases. */
(() => {
  const transport = window.BCCWorkspaceTransport;
  const contracts = window.BCCWorkspaceTaskContracts;

  async function run(operation) {
    try {
      return await operation();
    } catch (error) {
      throw contracts.toError(error);
    }
  }

  const repository = {
    list(options = {}) {
      return run(async () => contracts.tasks(await transport.request("/api/workspace/tasks", options)));
    },
    listCollaborators(options = {}) {
      return run(async () => contracts.collaborators(await transport.request("/api/workspace/task-collaborators", options)));
    },
    create(values, options = {}) {
      return run(async () => contracts.taskFrom(await transport.request("/api/workspace/tasks", {
        ...options,
        method: "POST",
        body: values
      })));
    },
    update(taskId, values, options = {}) {
      return run(async () => contracts.taskFrom(await transport.request(
        `/api/workspace/tasks/${encodeURIComponent(taskId)}`,
        { ...options, method: "PATCH", body: values }
      )));
    },
    remove(taskId, options = {}) {
      return run(() => transport.request(`/api/workspace/tasks/${encodeURIComponent(taskId)}`, {
        ...options,
        method: "DELETE"
      }));
    }
  };

  window.BCCWorkspaceTaskRepository = Object.freeze(repository);
})();
