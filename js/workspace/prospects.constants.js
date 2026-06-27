(() => {
  const PHASES = [
    { id: "lead", label: "Lead" },
    { id: "qualified", label: "Calificado" },
    { id: "contacted", label: "Contactado" },
    { id: "proposal", label: "Propuesta" },
    { id: "negotiation", label: "Negociación" },
    { id: "won", label: "Ganado" },
    { id: "lost", label: "Perdido" }
  ];

  const EMAIL_STATUSES = [
    { id: "draft", label: "Borrador" },
    { id: "scheduled", label: "Programado" },
    { id: "sent", label: "Enviado" },
    { id: "archived", label: "Archivado" }
  ];

  const TEMPLATE_HINTS = [
    "{{first_name}}",
    "{{full_name}}",
    "{{company}}",
    "{{email}}",
    "{{phase}}"
  ];

  const ACTIVITY_TYPES = [
    { id: "note", label: "Nota" },
    { id: "call", label: "Llamada" },
    { id: "meeting", label: "Reunión" },
    { id: "email", label: "Correo" },
    { id: "follow_up", label: "Follow-up" }
  ];

  window.BCCWorkspaceProspectsConstants = {
    PHASES,
    EMAIL_STATUSES,
    TEMPLATE_HINTS,
    ACTIVITY_TYPES,
    PROSPECTS_TIMEOUT_MS: 12000
  };
})();
