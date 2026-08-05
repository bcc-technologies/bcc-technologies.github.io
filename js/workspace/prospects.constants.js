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

  const TEMPLATE_CATEGORIES = [
    { id: "first_contact", label: "Primer contacto" },
    { id: "follow_up", label: "Seguimiento" },
    { id: "proposal", label: "Propuesta" },
    { id: "negotiation", label: "Negociación" },
    { id: "reactivation", label: "Reactivación" },
    { id: "closing", label: "Cierre" },
    { id: "internal", label: "Interno" }
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

  const EMAIL_DELIVERY_STATUSES = [
    { id: "delivered", label: "Entregado" },
    { id: "delivery_delayed", label: "Retrasado" },
    { id: "bounced", label: "Rebotado" },
    { id: "complained", label: "Marcado como spam" },
    { id: "opened", label: "Abierto" },
    { id: "clicked", label: "Clic registrado" },
    { id: "failed", label: "Fallido" }
  ];

  const ASSIGNMENT_STATUSES = [
    { id: "unassigned", label: "Sin responsable" },
    { id: "assigned", label: "Asignado" },
    { id: "accepted", label: "Aceptado" },
    { id: "declined", label: "Rechazado" },
    { id: "needs_reassignment", label: "Reasignar" }
  ];

  window.BCCWorkspaceProspectsConstants = {
    PHASES,
    EMAIL_STATUSES,
    EMAIL_DELIVERY_STATUSES,
    TEMPLATE_CATEGORIES,
    TEMPLATE_HINTS,
    ACTIVITY_TYPES,
    ASSIGNMENT_STATUSES,
    PROSPECTS_TIMEOUT_MS: 12000
  };
})();
