import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const defaultLocale = import.meta.env.VITE_DEFAULT_LOCALE || "en";

const en = {
  appName: "Komatsu API Marketplace",
  nav: {
    home: "Home",
    apis: "API Catalog",
    integrations: "My Integrations",
    support: "Support",
    news: "News",
    admin: "Admin"
  },
  header: {
    portal: "Portal",
    language: "Language",
    langEnglish: "English",
    langSpanish: "Español",
    signOut: "Sign out"
  },
  footer: {
    title: "Komatsu API Marketplace Portal",
    powered: "Powered by Komatsu custom APIM customization on Azure"
  },
  sideNav: { heading: "NAVIGATION" },
  error: {
    title: "Something went wrong.",
    description: "Please refresh the page or contact support if the issue persists.",
    refresh: "Refresh"
  },
  loading: { default: "Loading..." },
  auth: {
    signingIn: "Signing you in...",
    redirecting: "Redirecting to Entra ID..."
  },
  common: { details: "Details" },
  home: {
    hero: {
      overline: "KOMATSU API PORTAL",
      title: "Build the Future with Komatsu APIs",
      subtitle: "Access secure, enterprise-grade APIs to power your digital transformation. Streamline integrations, enhance productivity, and unlock new possibilities.",
      exploreButton: "Explore APIs",
      getStartedButton: "Get Started"
    },
    features: {
      heading: "Why Choose Komatsu API Portal",
      subheading: "Everything you need to integrate, innovate, and scale your applications with confidence",
      apiCatalog: { title: "Comprehensive API Catalog", description: "Access a wide range of enterprise APIs with detailed documentation and interactive testing capabilities." },
      security: { title: "Enterprise-Grade Security", description: "Role-based access control, OAuth 2.0 authentication, and secure API key management." },
      performance: { title: "High Performance", description: "Low-latency APIs with Azure infrastructure, SLA guarantees, and real-time monitoring." },
      integration: { title: "Easy Integration", description: "SDKs, code samples, and step-by-step guides to accelerate your integration journey." },
      devTools: { title: "Developer Tools", description: "Interactive API explorer, sandbox environments, and comprehensive testing utilities." },
      support: { title: "24/7 Support", description: "Expert technical support team ready to assist with integration challenges and questions." }
    },
    stats: { availableApis: "Available APIs", products: "Products", subscriptions: "Subscriptions", uptime: "Uptime" },
    quickActions: {
      heading: "Quick Actions",
      browse: { title: "Browse API Catalog", description: "Explore our comprehensive catalog of APIs with detailed documentation and specifications.", button: "Browse APIs" },
      integrations: { title: "My Integrations", description: "Manage your API subscriptions, keys, quotas, and monitor usage across all environments.", button: "Manage Integrations" },
      support: { title: "Get Support", description: "Submit support tickets, browse FAQs, and get help from our expert technical team.", button: "Get Help" }
    },
    featuredApis: { heading: "Featured APIs", loading: "Loading highlights...", empty: "No featured APIs available yet.", viewAll: "View All APIs" },
    news: { heading: "What's New", empty: "No announcements yet. Check back soon for updates!", viewAll: "View All News" },
    toast: { localData: "Using local highlight data until the portal API is ready.", loadFailed: "Failed to load some data. Using cached content." }
  },
  apis: {
    title: "API Catalog",
    subtitle: "Discover and explore APIs available on the Komatsu API Management platform.",
    searchPlaceholder: "Search by name, description, or path...",
    categoryLabel: "Category",
    allCategories: "All Categories",
    planLabel: "Plan",
    allPlans: "All Plans",
    filterCategory: "Category: {{value}}",
    filterPlan: "Plan: {{value}}",
    resultCount: "{{count}} APIs available",
    resultCountSingular: "{{count}} API",
    emptyTitle: "No APIs found",
    emptyFilterHint: "Try adjusting your search or filter criteria.",
    emptyNoData: "No APIs are currently published.",
    noDescription: "No description available.",
    keyRequired: "Key required",
    open: "Open",
    toast: { localData: "Using local catalog data until the portal API is ready." }
  },
  apiDetails: {
    notFound: "API not found.",
    loadError: "Failed to load API details.",
    backToCatalog: "Back to catalog",
    subscriptionRequired: "Subscription required",
    overview: "Overview",
    noDescription: "No description available for this API.",
    viewDocs: "View documentation",
    exportSpec: "Export OpenAPI spec",
    operationsTitle: "Operations ({{count}})",
    method: "Method",
    endpoint: "Endpoint",
    description: "Description",
    additionalInfo: "Additional Information",
    contact: "Contact",
    license: "License",
    unknownLicense: "Unknown",
    viewLicense: "View license",
    subscription: "Subscription",
    statusLabel: "Status:",
    notSubscribed: "Not subscribed",
    requestAccess: "Request access",
    testTitle: "Test this API",
    testDescription: "Use the interactive console to send requests and view responses in real time.",
    openTryIt: "Open Try-It Console",
    availablePlans: "Available Plans",
    quotaLabel: "Quota:"
  },
  tryIt: {
    title: "Try It",
    noSpec: "No OpenAPI specification available for this API.",
    contactOwner: "Contact the API owner to publish an OpenAPI spec.",
    titleWithName: "Try It — {{name}}",
    subtitle: "Interact with sandbox endpoints using your access token."
  },
  admin: {
    title: "Admin Console",
    subtitle: "Approve registrations, review catalog metadata, and monitor portal health.",
    pendingRegistrations: "Pending registrations",
    regionLabel: "Region:",
    approve: "Approve",
    reject: "Reject"
  },
  integrations: {
    title: "My Integrations",
    subtitle: "Subscriptions, credentials, and quota usage across your APIs.",
    empty: "No subscriptions yet.",
    quotaLabel: "Quota:",
    manage: "Manage"
  },
  support: {
    title: "Support",
    subtitle: "FAQs, ticket creation, and service history.",
    tabFaqs: "FAQs",
    tabCreateTicket: "Create Ticket",
    tabMyTickets: "My Tickets",
    faqsEmpty: "No FAQs loaded.",
    categoryLabel: "Category",
    apiLabel: "API",
    impactLabel: "Impact",
    descriptionLabel: "Description",
    submitTicket: "Submit ticket",
    ticketsEmpty: "No tickets yet."
  },
  news: {
    title: "News and Announcements",
    subtitle: "Latest updates from AEM.",
    empty: "No news articles yet.",
    tagsLabel: "Tags:"
  },
  register: {
    title: "Registration",
    subtitle: "Submit a dealer or vendor registration request for Komatsu APIs.",
    intendedApis: "Intended APIs",
    dataUsage: "Data usage details",
    submit: "Submit registration",
    approvalNote: "Submissions trigger the Logic Apps workflow for approval."
  },
  onboarding: {
    title: "Onboarding Status",
    subtitle: "Track your dealer or vendor onboarding request.",
    currentStatus: "Current status:",
    steps: { submitted: "Submitted", underReview: "Under Review", approved: "Approved", accessEnabled: "Access Enabled" }
  },
  accessDenied: {
    title: "Access denied",
    message: "You do not have permission to view this page."
  },
  notFound: {
    title: "Page not found",
    message: "The page you are looking for is not available.",
    goHome: "Go home"
  }
};

const es = {
  appName: "Komatsu API Marketplace",
  nav: {
    home: "Inicio",
    apis: "Catálogo de APIs",
    integrations: "Mis Integraciones",
    support: "Soporte",
    news: "Noticias",
    admin: "Administración"
  },
  header: {
    portal: "Portal",
    language: "Idioma",
    langEnglish: "English",
    langSpanish: "Español",
    signOut: "Cerrar sesión"
  },
  footer: {
    title: "Portal Komatsu API Marketplace",
    powered: "Impulsado por la personalización APIM de Komatsu en Azure"
  },
  sideNav: { heading: "NAVEGACIÓN" },
  error: {
    title: "Algo salió mal.",
    description: "Actualice la página o contacte a soporte si el problema persiste.",
    refresh: "Actualizar"
  },
  loading: { default: "Cargando..." },
  auth: {
    signingIn: "Iniciando sesión...",
    redirecting: "Redirigiendo a Entra ID..."
  },
  common: { details: "Detalles" },
  home: {
    hero: {
      overline: "PORTAL DE APIS KOMATSU",
      title: "Construye el Futuro con las APIs de Komatsu",
      subtitle: "Accede a APIs seguras de nivel empresarial para impulsar tu transformación digital. Simplifica integraciones, mejora la productividad y desbloquea nuevas posibilidades.",
      exploreButton: "Explorar APIs",
      getStartedButton: "Comenzar"
    },
    features: {
      heading: "Por Qué Elegir el Portal de APIs de Komatsu",
      subheading: "Todo lo que necesitas para integrar, innovar y escalar tus aplicaciones con confianza",
      apiCatalog: { title: "Catálogo Completo de APIs", description: "Accede a una amplia gama de APIs empresariales con documentación detallada y capacidades de pruebas interactivas." },
      security: { title: "Seguridad de Nivel Empresarial", description: "Control de acceso basado en roles, autenticación OAuth 2.0 y gestión segura de claves de API." },
      performance: { title: "Alto Rendimiento", description: "APIs de baja latencia con infraestructura Azure, garantías de SLA y monitoreo en tiempo real." },
      integration: { title: "Fácil Integración", description: "SDKs, ejemplos de código y guías paso a paso para acelerar tu integración." },
      devTools: { title: "Herramientas para Desarrolladores", description: "Explorador interactivo de APIs, entornos sandbox y utilidades completas de pruebas." },
      support: { title: "Soporte 24/7", description: "Equipo de soporte técnico experto listo para ayudar con desafíos de integración y consultas." }
    },
    stats: { availableApis: "APIs Disponibles", products: "Productos", subscriptions: "Suscripciones", uptime: "Disponibilidad" },
    quickActions: {
      heading: "Acciones Rápidas",
      browse: { title: "Explorar Catálogo de APIs", description: "Explora nuestro catálogo completo de APIs con documentación detallada y especificaciones.", button: "Explorar APIs" },
      integrations: { title: "Mis Integraciones", description: "Gestiona tus suscripciones de API, claves, cuotas y monitorea el uso en todos los entornos.", button: "Gestionar Integraciones" },
      support: { title: "Obtener Soporte", description: "Envía tickets de soporte, consulta preguntas frecuentes y obtén ayuda de nuestro equipo técnico.", button: "Obtener Ayuda" }
    },
    featuredApis: { heading: "APIs Destacadas", loading: "Cargando destacados...", empty: "Aún no hay APIs destacadas.", viewAll: "Ver Todas las APIs" },
    news: { heading: "Novedades", empty: "Aún no hay anuncios. ¡Vuelve pronto para actualizaciones!", viewAll: "Ver Todas las Noticias" },
    toast: { localData: "Usando datos locales hasta que la API del portal esté lista.", loadFailed: "Error al cargar algunos datos. Usando contenido en caché." }
  },
  apis: {
    title: "Catálogo de APIs",
    subtitle: "Descubre y explora las APIs disponibles en la plataforma de gestión de APIs de Komatsu.",
    searchPlaceholder: "Buscar por nombre, descripción o ruta...",
    categoryLabel: "Categoría",
    allCategories: "Todas las Categorías",
    planLabel: "Plan",
    allPlans: "Todos los Planes",
    filterCategory: "Categoría: {{value}}",
    filterPlan: "Plan: {{value}}",
    resultCount: "{{count}} APIs disponibles",
    resultCountSingular: "{{count}} API",
    emptyTitle: "No se encontraron APIs",
    emptyFilterHint: "Intenta ajustar tu búsqueda o criterios de filtro.",
    emptyNoData: "No hay APIs publicadas actualmente.",
    noDescription: "Sin descripción disponible.",
    keyRequired: "Clave requerida",
    open: "Abierta",
    toast: { localData: "Usando datos de catálogo locales hasta que la API del portal esté lista." }
  },
  apiDetails: {
    notFound: "API no encontrada.",
    loadError: "Error al cargar los detalles de la API.",
    backToCatalog: "Volver al catálogo",
    subscriptionRequired: "Suscripción requerida",
    overview: "Descripción General",
    noDescription: "No hay descripción disponible para esta API.",
    viewDocs: "Ver documentación",
    exportSpec: "Exportar especificación OpenAPI",
    operationsTitle: "Operaciones ({{count}})",
    method: "Método",
    endpoint: "Endpoint",
    description: "Descripción",
    additionalInfo: "Información Adicional",
    contact: "Contacto",
    license: "Licencia",
    unknownLicense: "Desconocida",
    viewLicense: "Ver licencia",
    subscription: "Suscripción",
    statusLabel: "Estado:",
    notSubscribed: "No suscrito",
    requestAccess: "Solicitar acceso",
    testTitle: "Probar esta API",
    testDescription: "Usa la consola interactiva para enviar solicitudes y ver respuestas en tiempo real.",
    openTryIt: "Abrir Consola de Pruebas",
    availablePlans: "Planes Disponibles",
    quotaLabel: "Cuota:"
  },
  tryIt: {
    title: "Probar",
    noSpec: "No hay especificación OpenAPI disponible para esta API.",
    contactOwner: "Contacta al propietario de la API para publicar una especificación OpenAPI.",
    titleWithName: "Probar — {{name}}",
    subtitle: "Interactúa con endpoints de prueba usando tu token de acceso."
  },
  admin: {
    title: "Consola de Administración",
    subtitle: "Aprobar registros, revisar metadatos del catálogo y monitorear la salud del portal.",
    pendingRegistrations: "Registros pendientes",
    regionLabel: "Región:",
    approve: "Aprobar",
    reject: "Rechazar"
  },
  integrations: {
    title: "Mis Integraciones",
    subtitle: "Suscripciones, credenciales y uso de cuotas en tus APIs.",
    empty: "Aún no hay suscripciones.",
    quotaLabel: "Cuota:",
    manage: "Gestionar"
  },
  support: {
    title: "Soporte",
    subtitle: "Preguntas frecuentes, creación de tickets y historial de servicio.",
    tabFaqs: "Preguntas Frecuentes",
    tabCreateTicket: "Crear Ticket",
    tabMyTickets: "Mis Tickets",
    faqsEmpty: "No hay preguntas frecuentes cargadas.",
    categoryLabel: "Categoría",
    apiLabel: "API",
    impactLabel: "Impacto",
    descriptionLabel: "Descripción",
    submitTicket: "Enviar ticket",
    ticketsEmpty: "Aún no hay tickets."
  },
  news: {
    title: "Noticias y Anuncios",
    subtitle: "Últimas actualizaciones de AEM.",
    empty: "Aún no hay artículos de noticias.",
    tagsLabel: "Etiquetas:"
  },
  register: {
    title: "Registro",
    subtitle: "Envía una solicitud de registro de distribuidor o proveedor para las APIs de Komatsu.",
    intendedApis: "APIs previstas",
    dataUsage: "Detalles de uso de datos",
    submit: "Enviar registro",
    approvalNote: "Los envíos activan el flujo de trabajo de Logic Apps para aprobación."
  },
  onboarding: {
    title: "Estado de Incorporación",
    subtitle: "Sigue el estado de tu solicitud de incorporación como distribuidor o proveedor.",
    currentStatus: "Estado actual:",
    steps: { submitted: "Enviado", underReview: "En Revisión", approved: "Aprobado", accessEnabled: "Acceso Habilitado" }
  },
  accessDenied: {
    title: "Acceso denegado",
    message: "No tienes permiso para ver esta página."
  },
  notFound: {
    title: "Página no encontrada",
    message: "La página que buscas no está disponible.",
    goHome: "Ir al inicio"
  }
};

i18n.use(initReactI18next).init({
  lng: defaultLocale,
  fallbackLng: "en",
  resources: {
    en: { translation: en },
    es: { translation: es }
  },
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
