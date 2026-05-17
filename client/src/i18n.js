import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  es: {
    translation: {
      dashboard: {
        summary: "Resumen",
        production_mgmt: "Gestión de Producción",
        projects: "Proyectos",
        blowing: "Soplado",
        fusion: "Fusión",
        appointments: "Citas (Back Office)",
        issues: "Averías / Incidencias",
        activations: "Activaciones",
        protocols: "Protocolos",
        prod_control: "Control de Producción",
        economy_area: "Área Económica",
        earnings: "Mis Ganancias",
        invoicing: "Facturación Clientes",
        payroll: "Nóminas (Admin)",
        fleet: "Control de Flota",
        company: "Mi Empresa",
        profitability: "Sist. de Rentabilidad",
        hr: "Recursos Humanos",
        users: "Usuarios",
        teams: "Equipos",
        vacations_admin: "Vacaciones Personal",
        services_personnel: "Servicios y Personal",
        material_orders: "Pedidos de Material",
        my_vehicle: "Mi Vehículo",
        my_vacations: "Mis Vacaciones",
        change_password: "Cambiar Contraseña",
        logout: "Cerrar Sesión",
        notifications: "Notificaciones",
        clear_all: "Limpiar todo",
        no_notifications: "No tienes notificaciones.",
        date: "Fecha",
        management: "Gestión integral de",
        new_notification: "Nueva Notificación"
      }
    }
  },
  de: {
    translation: {
      dashboard: {
        summary: "Übersicht",
        production_mgmt: "Produktionsmanagement",
        projects: "Projekte",
        blowing: "Kabelzug / Einblasen",
        fusion: "Spleißen",
        appointments: "Termine (Back Office)",
        issues: "Störungen / Vorfälle",
        activations: "Aktivierungen",
        protocols: "Protokolle",
        prod_control: "Produktionskontrolle",
        economy_area: "Wirtschaftsbereich",
        earnings: "Mein Einkommen",
        invoicing: "Kundenabrechnung",
        payroll: "Gehaltsabrechnung (Admin)",
        fleet: "Fuhrparkmanagement",
        company: "Mein Unternehmen",
        profitability: "Rentabilitätssystem",
        hr: "Personalwesen",
        users: "Benutzer",
        teams: "Teams",
        vacations_admin: "Personalurlaub",
        services_personnel: "Dienste & Personal",
        material_orders: "Materialbestellungen",
        my_vehicle: "Mein Fahrzeug",
        my_vacations: "Mein Urlaub",
        change_password: "Passwort ändern",
        logout: "Abmelden",
        notifications: "Benachrichtigungen",
        clear_all: "Alle löschen",
        no_notifications: "Sie haben keine Benachrichtigungen.",
        date: "Datum",
        management: "Integrierte Verwaltung von",
        new_notification: "Neue Benachrichtigung"
      }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false, // react already safes from xss
    }
  });

export default i18n;
