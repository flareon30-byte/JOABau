--
-- PostgreSQL database dump
--

\restrict rivu8LKS7qNrkuro7EmoMR6xcT5AhlseFdUQtxXHzpJJj5oIGUEQGjm2QjDe8X8

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


--
-- Name: ActivationType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ActivationType" AS ENUM (
    'BP',
    'BP_2_FAM',
    'BR_MULTI',
    'SDU',
    'MDU'
);


ALTER TYPE public."ActivationType" OWNER TO postgres;

--
-- Name: AppointmentStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."AppointmentStatus" AS ENUM (
    'PENDIENTE',
    'CITADO',
    'COMPLETADO',
    'CANCELADO',
    'RECITAR'
);


ALTER TYPE public."AppointmentStatus" OWNER TO postgres;

--
-- Name: Department; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Department" AS ENUM (
    'ACTIVATION',
    'BLOWING',
    'BACK_OFFICE',
    'PROTOCOLS',
    'FUSION'
);


ALTER TYPE public."Department" OWNER TO postgres;

--
-- Name: MaterialOrderStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."MaterialOrderStatus" AS ENUM (
    'PENDIENTE',
    'REALIZADO',
    'EN_ALMACEN'
);


ALTER TYPE public."MaterialOrderStatus" OWNER TO postgres;

--
-- Name: Role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Role" AS ENUM (
    'SUPER_ADMIN',
    'ADMIN',
    'BACK_OFFICE',
    'ACTIVATOR',
    'BLOWER',
    'PROTOCOL_MANAGER'
);


ALTER TYPE public."Role" OWNER TO postgres;

--
-- Name: SopladoStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."SopladoStatus" AS ENUM (
    'OK',
    'FALLIDO',
    'PENDIENTE'
);


ALTER TYPE public."SopladoStatus" OWNER TO postgres;

--
-- Name: VacationStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."VacationStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'DENIED'
);


ALTER TYPE public."VacationStatus" OWNER TO postgres;

--
-- Name: VacationType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."VacationType" AS ENUM (
    'VACATION',
    'DAY_OFF'
);


ALTER TYPE public."VacationType" OWNER TO postgres;

--
-- Name: VehicleLogType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."VehicleLogType" AS ENUM (
    'FUEL',
    'ODOMETER',
    'MAINTENANCE'
);


ALTER TYPE public."VehicleLogType" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ActivationInfo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ActivationInfo" (
    id text NOT NULL,
    "addressId" text NOT NULL,
    "activationType" public."ActivationType" NOT NULL,
    "familiesCount" integer NOT NULL,
    "apPorts" integer NOT NULL,
    "hasMoreClients" boolean NOT NULL,
    "spInstalled" integer DEFAULT 0 NOT NULL,
    "taInstalled" boolean NOT NULL,
    photos text[],
    points double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    description text,
    "homeIds" text[],
    "isSaturday" boolean DEFAULT false NOT NULL,
    "taCount" integer DEFAULT 0 NOT NULL,
    "pdfPath" text,
    "basePrice" double precision DEFAULT 0.0 NOT NULL,
    "isRepair" boolean DEFAULT false NOT NULL,
    "mduInstalled" boolean DEFAULT false NOT NULL,
    "mduPrice" double precision DEFAULT 0.0 NOT NULL,
    "repairPrice" double precision DEFAULT 0.0 NOT NULL,
    "spPrice" double precision DEFAULT 0.0 NOT NULL,
    "taPrice" double precision DEFAULT 0.0 NOT NULL,
    "saturdayPay" double precision DEFAULT 0.0 NOT NULL,
    "customActivationName" text,
    "invoiceId" text,
    "performerIds" text[]
);


ALTER TABLE public."ActivationInfo" OWNER TO postgres;

--
-- Name: Address; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Address" (
    id text NOT NULL,
    "projectId" text NOT NULL,
    nvt text,
    street text NOT NULL,
    number text,
    "sopladoStatus" public."SopladoStatus",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "clientName" text,
    city text,
    "klsId" text,
    "orderStatus" text DEFAULT 'geplant'::text,
    "protocolStatus" text DEFAULT 'NONE'::text NOT NULL,
    "requiresProtocol" boolean DEFAULT false NOT NULL,
    "apartmentCount" integer,
    "bauauftragId" text
);


ALTER TABLE public."Address" OWNER TO postgres;

--
-- Name: Appointment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Appointment" (
    id text NOT NULL,
    "addressId" text NOT NULL,
    "contactAttempts" integer DEFAULT 0 NOT NULL,
    "contactHistory" text[],
    "assignedDate" timestamp(3) without time zone,
    "assignedTeamId" text,
    status public."AppointmentStatus" DEFAULT 'PENDIENTE'::public."AppointmentStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "apartmentCount" integer,
    "clientName" text,
    "reciteReason" text,
    type text DEFAULT 'ACTIVATION'::text NOT NULL,
    "scheduledById" text
);


ALTER TABLE public."Appointment" OWNER TO postgres;

--
-- Name: ClientCompany; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ClientCompany" (
    id text NOT NULL,
    name text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    settings jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    address text,
    "billingEmail" text,
    city text,
    country text DEFAULT 'ES'::text NOT NULL,
    "defaultVat" double precision DEFAULT 21.0 NOT NULL,
    "postalCode" text,
    "taxId" text,
    "legalName" text
);


ALTER TABLE public."ClientCompany" OWNER TO postgres;

--
-- Name: ClientPriceItem; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ClientPriceItem" (
    id text NOT NULL,
    "clientCompanyId" text NOT NULL,
    name text NOT NULL,
    department public."Department" NOT NULL,
    "priceToClient" double precision DEFAULT 0.0 NOT NULL,
    "bonusToTeam" double precision DEFAULT 0.0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "saturdayPay" double precision DEFAULT 0.0 NOT NULL
);


ALTER TABLE public."ClientPriceItem" OWNER TO postgres;

--
-- Name: Comment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Comment" (
    id text NOT NULL,
    content text NOT NULL,
    "authorName" text NOT NULL,
    "appointmentId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    photos text[] DEFAULT ARRAY[]::text[]
);


ALTER TABLE public."Comment" OWNER TO postgres;

--
-- Name: CompanySettings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."CompanySettings" (
    id text NOT NULL,
    name text DEFAULT 'JOA Technologien'::text NOT NULL,
    "taxId" text,
    address text,
    phone text,
    email text,
    "bankDetails" text,
    "logoPath" text,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    city text,
    country text DEFAULT 'ES'::text NOT NULL
);


ALTER TABLE public."CompanySettings" OWNER TO postgres;

--
-- Name: DietaLog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DietaLog" (
    id text NOT NULL,
    "userId" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    type text NOT NULL,
    amount double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "isSaturday" boolean DEFAULT false NOT NULL
);


ALTER TABLE public."DietaLog" OWNER TO postgres;

--
-- Name: FusionInfo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."FusionInfo" (
    id text NOT NULL,
    "addressId" text NOT NULL,
    description text NOT NULL,
    photos text[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."FusionInfo" OWNER TO postgres;

--
-- Name: FusionWork; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."FusionWork" (
    id text NOT NULL,
    "projectId" text NOT NULL,
    "nvtName" text NOT NULL,
    "fusionCount" integer NOT NULL,
    "isTray" boolean DEFAULT false NOT NULL,
    photos text[],
    description text,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "invoiceId" text
);


ALTER TABLE public."FusionWork" OWNER TO postgres;

--
-- Name: Invoice; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Invoice" (
    id text NOT NULL,
    number text NOT NULL,
    "clientId" text NOT NULL,
    date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "dueDate" timestamp(3) without time zone,
    subtotal double precision NOT NULL,
    "vatAmount" double precision NOT NULL,
    total double precision NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "pdfPath" text,
    items jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Invoice" OWNER TO postgres;

--
-- Name: MaterialOrder; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."MaterialOrder" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "materialDescription" text NOT NULL,
    "timeRemaining" text NOT NULL,
    status public."MaterialOrderStatus" DEFAULT 'PENDIENTE'::public."MaterialOrderStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."MaterialOrder" OWNER TO postgres;

--
-- Name: Notification; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    type text NOT NULL,
    message text NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL,
    "addressId" text,
    "createdById" text,
    "targetRole" public."Role",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Notification" OWNER TO postgres;

--
-- Name: PayrollLog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PayrollLog" (
    id text NOT NULL,
    "userId" text NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    "cycleStart" timestamp(3) without time zone NOT NULL,
    "cycleEnd" timestamp(3) without time zone NOT NULL,
    points double precision DEFAULT 0.0 NOT NULL,
    "pointEarnings" double precision DEFAULT 0.0 NOT NULL,
    "dietasCount" integer DEFAULT 0 NOT NULL,
    "dietasAmount" double precision DEFAULT 0.0 NOT NULL,
    "saturdayPay" double precision DEFAULT 0.0 NOT NULL,
    "totalEuros" double precision DEFAULT 0.0 NOT NULL,
    status text DEFAULT 'CLOSED'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."PayrollLog" OWNER TO postgres;

--
-- Name: Project; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Project" (
    id text NOT NULL,
    name text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isDemo" boolean DEFAULT false NOT NULL,
    "clientCompanyId" text
);


ALTER TABLE public."Project" OWNER TO postgres;

--
-- Name: PushSubscription; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PushSubscription" (
    id text NOT NULL,
    "userId" text NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."PushSubscription" OWNER TO postgres;

--
-- Name: Repair; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Repair" (
    id text NOT NULL,
    "addressId" text NOT NULL,
    description text NOT NULL,
    photos text[],
    "technicianId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Repair" OWNER TO postgres;

--
-- Name: SimpleInstallation; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SimpleInstallation" (
    id text NOT NULL,
    "addressId" text NOT NULL,
    "contactName" text,
    comments text,
    photos text[],
    "priceCharged" double precision DEFAULT 0.0 NOT NULL,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "customerFirstName" text,
    "customerLastName" text,
    "gponSerialNumber" text,
    "gpsAlt" double precision,
    "gpsLat" double precision,
    "gpsLng" double precision,
    "isReadyForOperation" boolean DEFAULT true,
    olt text,
    "photoHuep" text,
    "photoModem" text,
    "photoOtdr" text,
    pon text,
    "signaturePath" text,
    "splitterPort" text,
    "pdfPath" text,
    "invoiceId" text
);


ALTER TABLE public."SimpleInstallation" OWNER TO postgres;

--
-- Name: SimpleInstallationItem; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SimpleInstallationItem" (
    id text NOT NULL,
    "simpleInstallationId" text NOT NULL,
    "priceItemId" text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    "priceAtTime" double precision NOT NULL,
    "bonusAtTime" double precision NOT NULL
);


ALTER TABLE public."SimpleInstallationItem" OWNER TO postgres;

--
-- Name: SopladoInfo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SopladoInfo" (
    id text NOT NULL,
    "addressId" text NOT NULL,
    meters double precision NOT NULL,
    tk text NOT NULL,
    "tubeColor" text NOT NULL,
    "failureReason" text,
    photos text[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isSaturday" boolean DEFAULT false NOT NULL,
    "teamId" text,
    "saturdayPay" double precision DEFAULT 0.0 NOT NULL,
    "invoiceId" text,
    "performerIds" text[]
);


ALTER TABLE public."SopladoInfo" OWNER TO postgres;

--
-- Name: SystemSettings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SystemSettings" (
    id text NOT NULL,
    "extraPointPrice" double precision DEFAULT 0.0 NOT NULL,
    "saturdayPointPrice" double precision DEFAULT 0.0 NOT NULL,
    "monthlyTargetPoints" integer DEFAULT 100 NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "bp2FamPoints" double precision DEFAULT 15.0 NOT NULL,
    "bpPoints" double precision DEFAULT 10.0 NOT NULL,
    "brMultiPoints" double precision DEFAULT 20.0 NOT NULL,
    "mduPoints" double precision DEFAULT 30.0 NOT NULL,
    "sduPoints" double precision DEFAULT 25.0 NOT NULL,
    "spPoints" double precision DEFAULT 5.0 NOT NULL,
    "taPoints" double precision DEFAULT 0.5 NOT NULL,
    financials jsonb,
    "isDemo" boolean DEFAULT false NOT NULL,
    "repairPrice" double precision DEFAULT 45.0 NOT NULL
);


ALTER TABLE public."SystemSettings" OWNER TO postgres;

--
-- Name: Team; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Team" (
    id text NOT NULL,
    name text NOT NULL,
    department public."Department" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isDemo" boolean DEFAULT false NOT NULL,
    "activeClientCompanyId" text,
    "vehicleId" text
);


ALTER TABLE public."Team" OWNER TO postgres;

--
-- Name: Tool; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Tool" (
    id text NOT NULL,
    name text NOT NULL,
    "serialNumber" text NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "teamId" text NOT NULL,
    photos text[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Tool" OWNER TO postgres;

--
-- Name: User; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."User" (
    id text NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    role public."Role" NOT NULL,
    "teamId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    phone text,
    "baseSalary" double precision DEFAULT 1500.0 NOT NULL,
    "isDemo" boolean DEFAULT false NOT NULL,
    "vacationDaysTotal" integer DEFAULT 30 NOT NULL,
    "activeClientCompanyId" text
);


ALTER TABLE public."User" OWNER TO postgres;

--
-- Name: VacationRequest; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."VacationRequest" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    type public."VacationType" DEFAULT 'VACATION'::public."VacationType" NOT NULL,
    status public."VacationStatus" DEFAULT 'PENDING'::public."VacationStatus" NOT NULL,
    reason text,
    "managerComment" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."VacationRequest" OWNER TO postgres;

--
-- Name: Vehicle; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Vehicle" (
    id text NOT NULL,
    make text NOT NULL,
    model text NOT NULL,
    plate text NOT NULL,
    "initialKms" double precision DEFAULT 0.0 NOT NULL,
    "currentKms" double precision DEFAULT 0.0 NOT NULL,
    "annualKmLimit" double precision DEFAULT 10000.0 NOT NULL,
    "isDemo" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Vehicle" OWNER TO postgres;

--
-- Name: VehicleLog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."VehicleLog" (
    id text NOT NULL,
    "vehicleId" text NOT NULL,
    type public."VehicleLogType" DEFAULT 'FUEL'::public."VehicleLogType" NOT NULL,
    kms double precision,
    amount double precision,
    liters double precision,
    photos text[],
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."VehicleLog" OWNER TO postgres;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Data for Name: ActivationInfo; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ActivationInfo" (id, "addressId", "activationType", "familiesCount", "apPorts", "hasMoreClients", "spInstalled", "taInstalled", photos, points, "createdAt", "updatedAt", description, "homeIds", "isSaturday", "taCount", "pdfPath", "basePrice", "isRepair", "mduInstalled", "mduPrice", "repairPrice", "spPrice", "taPrice", "saturdayPay", "customActivationName", "invoiceId", "performerIds") FROM stdin;
10a703e2-338b-4322-a436-abcbb819cc8b	c54b8b8d-ca19-4000-8664-cc9a64f996b6	SDU	1	1	f	1	t	{}	30	2026-04-03 15:45:56.674	2026-04-13 08:00:19.152	Instalación Demo Exitosa	\N	f	0	\N	0	f	f	0	0	0	0	0	\N	\N	{323c9f64-a0a3-4240-89c3-5103161c7c77,7c63aba1-377d-4f16-9da9-20c66620bf9f}
904a2b79-699c-48e0-9d79-fd9bccc01672	8418ae42-8f6d-403c-b67f-24cf49fd3827	SDU	1	1	f	1	t	{}	30	2026-04-03 15:45:56.677	2026-04-13 08:00:19.155	Instalación Demo Exitosa	\N	f	0	\N	0	f	f	0	0	0	0	0	\N	\N	{323c9f64-a0a3-4240-89c3-5103161c7c77,7c63aba1-377d-4f16-9da9-20c66620bf9f}
a768f644-219e-4132-ad17-ab3674bdcb4d	e6669158-ceca-4f42-b1ed-05085dc073cf	SDU	1	1	f	1	t	{}	30	2026-04-03 15:45:56.678	2026-04-13 08:00:19.156	Instalación Demo Exitosa	\N	f	0	\N	0	f	f	0	0	0	0	0	\N	\N	{323c9f64-a0a3-4240-89c3-5103161c7c77,7c63aba1-377d-4f16-9da9-20c66620bf9f}
\.


--
-- Data for Name: Address; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Address" (id, "projectId", nvt, street, number, "sopladoStatus", "createdAt", "updatedAt", "clientName", city, "klsId", "orderStatus", "protocolStatus", "requiresProtocol", "apartmentCount", "bauauftragId") FROM stdin;
29a4dfec-e623-48aa-beb5-a7f6a7f09ddd	5483700a-9ed3-409a-91dd-50b714860ba3	NVT-01	Calle Demo	1	\N	2026-02-19 16:37:17.095	2026-02-19 16:37:17.095	Cliente Pendiente	Ciudad Demo	\N	geplant	NONE	f	\N	\N
24952c4a-2964-4e16-943f-12b08941063b	5483700a-9ed3-409a-91dd-50b714860ba3	NVT-01	Calle Demo	2	\N	2026-02-19 16:37:17.101	2026-02-19 16:37:17.101	Cliente Completado	Ciudad Demo	\N	geplant	NONE	f	\N	\N
8c6d12ad-a839-4402-b38d-b8e802d6738e	5483700a-9ed3-409a-91dd-50b714860ba3	NVT-02	Calle Averia	5	\N	2026-02-19 16:37:17.105	2026-02-19 16:37:17.105	Cliente Averia	Ciudad Demo	\N	geplant	NONE	f	\N	\N
27407f13-fddc-4d60-a65c-fe16912637e1	9ae02371-fd3e-45fc-92b8-550a35d6fc69	NVT-02	Lindenweg	6A	\N	2026-04-03 15:45:56.659	2026-04-03 15:45:56.659	Familie Testkunde 6	Berlin	\N	geplant	NONE	t	\N	\N
bfd07c30-976b-4c04-83f7-e9029d216cf3	9ae02371-fd3e-45fc-92b8-550a35d6fc69	NVT-02	Bahnhofstraße	7A	\N	2026-04-03 15:45:56.659	2026-04-03 15:45:56.659	Familie Testkunde 7	Berlin	\N	geplant	NONE	f	\N	\N
b3916fce-6ff0-418b-bd40-0a532368c211	9ae02371-fd3e-45fc-92b8-550a35d6fc69	NVT-02	Lindenweg	8A	\N	2026-04-03 15:45:56.659	2026-04-03 15:45:56.659	Familie Testkunde 8	Berlin	\N	geplant	NONE	f	\N	\N
13478e30-1faf-4771-b7d2-98c0fb621e0c	9ae02371-fd3e-45fc-92b8-550a35d6fc69	NVT-02	Lindenweg	9A	\N	2026-04-03 15:45:56.659	2026-04-03 15:45:56.659	Familie Testkunde 9	Berlin	\N	geplant	NONE	t	\N	\N
2c0adf62-bf5f-4c13-bc55-e76312924b30	9ae02371-fd3e-45fc-92b8-550a35d6fc69	NVT-02	Bahnhofstraße	10A	\N	2026-04-03 15:45:56.659	2026-04-03 15:45:56.659	Familie Testkunde 10	Berlin	\N	geplant	NONE	f	\N	\N
dd5e4942-a39c-473b-8e0e-cccc8c95987c	9ae02371-fd3e-45fc-92b8-550a35d6fc69	NVT-03	Bahnhofstraße	11A	\N	2026-04-03 15:45:56.659	2026-04-03 15:45:56.659	Familie Testkunde 11	Berlin	\N	geplant	NONE	f	\N	\N
d0ed5678-951f-4606-b588-277ddb7d7ee7	9ae02371-fd3e-45fc-92b8-550a35d6fc69	NVT-03	Lindenweg	12A	\N	2026-04-03 15:45:56.659	2026-04-03 15:45:56.659	Familie Testkunde 12	Berlin	\N	geplant	NONE	t	\N	\N
c6b0d476-b99a-411a-9110-1c3a134093fd	9ae02371-fd3e-45fc-92b8-550a35d6fc69	NVT-03	Lindenweg	13A	\N	2026-04-03 15:45:56.659	2026-04-03 15:45:56.659	Familie Testkunde 13	Berlin	\N	geplant	NONE	f	\N	\N
b1b9985f-fd8d-4d1e-97d2-58e7aa091332	9ae02371-fd3e-45fc-92b8-550a35d6fc69	NVT-03	Bahnhofstraße	14A	\N	2026-04-03 15:45:56.659	2026-04-03 15:45:56.659	Familie Testkunde 14	Berlin	\N	geplant	NONE	f	\N	\N
47125505-f291-471a-a8bb-499ff6aad3e6	9ae02371-fd3e-45fc-92b8-550a35d6fc69	NVT-03	Hauptstraße	15A	\N	2026-04-03 15:45:56.659	2026-04-03 15:45:56.659	Familie Testkunde 15	Berlin	\N	geplant	NONE	t	\N	\N
eded3340-1470-4071-a28c-2934066610eb	9ae02371-fd3e-45fc-92b8-550a35d6fc69	NVT-04	Musterstraße	16A	\N	2026-04-03 15:45:56.659	2026-04-03 15:45:56.659	Familie Testkunde 16	Berlin	\N	geplant	NONE	f	\N	\N
7e6effb0-a393-49b4-afb0-68078bca5e64	9ae02371-fd3e-45fc-92b8-550a35d6fc69	NVT-04	Bahnhofstraße	17A	\N	2026-04-03 15:45:56.659	2026-04-03 15:45:56.659	Familie Testkunde 17	Berlin	\N	geplant	NONE	f	\N	\N
62f26207-988e-41cd-87ec-0595ba7ef472	9ae02371-fd3e-45fc-92b8-550a35d6fc69	NVT-04	Musterstraße	18A	\N	2026-04-03 15:45:56.659	2026-04-03 15:45:56.659	Familie Testkunde 18	Berlin	\N	geplant	NONE	t	\N	\N
d83bc8ba-ce86-4a91-bcaa-68cb4810e653	9ae02371-fd3e-45fc-92b8-550a35d6fc69	NVT-04	Bahnhofstraße	19A	\N	2026-04-03 15:45:56.659	2026-04-03 15:45:56.659	Familie Testkunde 19	Berlin	\N	geplant	NONE	f	\N	\N
ab6b29c7-9b89-4671-b2b4-f19b9daadc54	9ae02371-fd3e-45fc-92b8-550a35d6fc69	NVT-04	Lindenweg	20A	\N	2026-04-03 15:45:56.659	2026-04-03 15:45:56.659	Familie Testkunde 20	Berlin	\N	geplant	NONE	f	\N	\N
c54b8b8d-ca19-4000-8664-cc9a64f996b6	9ae02371-fd3e-45fc-92b8-550a35d6fc69	NVT-01	Lindenweg	1A	OK	2026-04-03 15:45:56.659	2026-04-03 15:45:56.664	Familie Testkunde 1	Berlin	\N	geplant	NONE	f	\N	\N
8418ae42-8f6d-403c-b67f-24cf49fd3827	9ae02371-fd3e-45fc-92b8-550a35d6fc69	NVT-01	Bahnhofstraße	2A	OK	2026-04-03 15:45:56.659	2026-04-03 15:45:56.668	Familie Testkunde 2	Berlin	\N	geplant	NONE	f	\N	\N
e6669158-ceca-4f42-b1ed-05085dc073cf	9ae02371-fd3e-45fc-92b8-550a35d6fc69	NVT-01	Bahnhofstraße	3A	OK	2026-04-03 15:45:56.659	2026-04-03 15:45:56.669	Familie Testkunde 3	Berlin	\N	geplant	NONE	t	\N	\N
9ebbeeb4-be5d-4585-a562-60bba9766870	9ae02371-fd3e-45fc-92b8-550a35d6fc69	NVT-01	Lindenweg	4A	OK	2026-04-03 15:45:56.659	2026-04-03 15:45:56.671	Familie Testkunde 4	Berlin	\N	geplant	NONE	f	\N	\N
3b93f9a8-11f5-40d6-953b-302afd05dc2f	9ae02371-fd3e-45fc-92b8-550a35d6fc69	NVT-01	Musterstraße	5A	OK	2026-04-03 15:45:56.659	2026-04-03 15:45:56.672	Familie Testkunde 5	Berlin	\N	geplant	NONE	f	\N	\N
\.


--
-- Data for Name: Appointment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Appointment" (id, "addressId", "contactAttempts", "contactHistory", "assignedDate", "assignedTeamId", status, "createdAt", "updatedAt", "apartmentCount", "clientName", "reciteReason", type, "scheduledById") FROM stdin;
80e2ca6c-e1d7-4c33-a6c8-d3df85d58519	29a4dfec-e623-48aa-beb5-a7f6a7f09ddd	0	\N	2026-02-19 16:37:17.093	team-instaladores-a	CITADO	2026-02-19 16:37:17.095	2026-02-19 16:37:17.095	1	Cliente Pendiente	\N	ACTIVATION	\N
5cce78c5-97a5-48b1-a341-4437a6243eb1	24952c4a-2964-4e16-943f-12b08941063b	0	\N	2026-02-19 16:37:17.099	team-instaladores-a	COMPLETADO	2026-02-19 16:37:17.101	2026-02-19 16:37:17.101	1	Cliente Completado	\N	ACTIVATION	\N
f73935fb-bded-4eed-a579-a9639654ca02	8c6d12ad-a839-4402-b38d-b8e802d6738e	0	\N	2026-02-19 16:37:17.104	team-instaladores-a	COMPLETADO	2026-02-19 16:37:17.105	2026-02-19 16:37:17.105	1	Cliente Averia	\N	ACTIVATION	\N
\.


--
-- Data for Name: ClientCompany; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ClientCompany" (id, name, "isActive", settings, "createdAt", "updatedAt", address, "billingEmail", city, country, "defaultVat", "postalCode", "taxId", "legalName") FROM stdin;
77b89ff3-c77a-481b-94b3-62109b6e4b11	CLIENTE PRINCIPAL	t	\N	2026-04-06 09:08:55.018	2026-04-06 09:08:55.018	Dirección del Cliente, Ciudad, España	\N	\N	ES	21	\N	CIF-CLIENTE-PENDIENTE	\N
\.


--
-- Data for Name: ClientPriceItem; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ClientPriceItem" (id, "clientCompanyId", name, department, "priceToClient", "bonusToTeam", "createdAt", "updatedAt", "saturdayPay") FROM stdin;
price-Activación-Estándar	77b89ff3-c77a-481b-94b3-62109b6e4b11	Activación Estándar	ACTIVATION	250	20	2026-04-06 09:08:55.025	2026-04-06 09:08:55.025	0
price-Instalación-SP	77b89ff3-c77a-481b-94b3-62109b6e4b11	Instalación SP	ACTIVATION	75	0	2026-04-06 09:08:55.028	2026-04-06 09:08:55.028	0
price-Instalación-TA	77b89ff3-c77a-481b-94b3-62109b6e4b11	Instalación TA	ACTIVATION	50	10	2026-04-06 09:08:55.029	2026-04-06 09:08:55.029	0
price-Instalación-MDU	77b89ff3-c77a-481b-94b3-62109b6e4b11	Instalación MDU	ACTIVATION	50	10	2026-04-06 09:08:55.03	2026-04-06 09:08:55.03	0
price-Activación-Multi-familia	77b89ff3-c77a-481b-94b3-62109b6e4b11	Activación Multi-familia	ACTIVATION	100	10	2026-04-06 09:08:55.031	2026-04-06 09:08:55.031	0
price-Soplado-(por-metro)	77b89ff3-c77a-481b-94b3-62109b6e4b11	Soplado (por metro)	BLOWING	0.4	0.05	2026-04-06 09:08:55.032	2026-04-06 09:08:55.032	0
price-Cita-Concertada	77b89ff3-c77a-481b-94b3-62109b6e4b11	Cita Concertada	BACK_OFFICE	15	0	2026-04-06 09:08:55.033	2026-04-06 09:08:55.033	0
price-Avería-/-Reparación	77b89ff3-c77a-481b-94b3-62109b6e4b11	Avería / Reparación	ACTIVATION	45	0	2026-04-06 09:08:55.034	2026-04-06 09:08:55.034	0
\.


--
-- Data for Name: Comment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Comment" (id, content, "authorName", "appointmentId", "createdAt", photos) FROM stdin;
\.


--
-- Data for Name: CompanySettings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."CompanySettings" (id, name, "taxId", address, phone, email, "bankDetails", "logoPath", "updatedAt", city, country) FROM stdin;
default-joa-cfg	JOA Technologien	B12345678	Calle Ejemplo 123, Madrid, España	+34 600 000 000	info@joatechnologien.de	ES00 0000 0000 0000 0000 0000	\N	2026-04-06 09:07:41.027	\N	ES
\.


--
-- Data for Name: DietaLog; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."DietaLog" (id, "userId", date, type, amount, "createdAt", "isSaturday") FROM stdin;
\.


--
-- Data for Name: FusionInfo; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."FusionInfo" (id, "addressId", description, photos, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: FusionWork; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."FusionWork" (id, "projectId", "nvtName", "fusionCount", "isTray", photos, description, "createdById", "createdAt", "invoiceId") FROM stdin;
\.


--
-- Data for Name: Invoice; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Invoice" (id, number, "clientId", date, "dueDate", subtotal, "vatAmount", total, status, "pdfPath", items, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: MaterialOrder; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."MaterialOrder" (id, "userId", "materialDescription", "timeRemaining", status, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Notification" (id, type, message, "isRead", "addressId", "createdById", "targetRole", "createdAt") FROM stdin;
\.


--
-- Data for Name: PayrollLog; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PayrollLog" (id, "userId", month, year, "cycleStart", "cycleEnd", points, "pointEarnings", "dietasCount", "dietasAmount", "saturdayPay", "totalEuros", status, "createdAt") FROM stdin;
\.


--
-- Data for Name: Project; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Project" (id, name, "createdAt", "updatedAt", "isDemo", "clientCompanyId") FROM stdin;
5483700a-9ed3-409a-91dd-50b714860ba3	Proyecto Demo	2026-02-19 16:37:17.09	2026-04-06 09:08:55.036	f	77b89ff3-c77a-481b-94b3-62109b6e4b11
9ae02371-fd3e-45fc-92b8-550a35d6fc69	Fiber City Demo 2026	2026-04-03 15:45:56.657	2026-04-06 09:08:55.036	t	77b89ff3-c77a-481b-94b3-62109b6e4b11
\.


--
-- Data for Name: PushSubscription; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PushSubscription" (id, "userId", endpoint, p256dh, auth, "createdAt") FROM stdin;
\.


--
-- Data for Name: Repair; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Repair" (id, "addressId", description, photos, "technicianId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: SimpleInstallation; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SimpleInstallation" (id, "addressId", "contactName", comments, photos, "priceCharged", "createdById", "createdAt", "updatedAt", "customerFirstName", "customerLastName", "gponSerialNumber", "gpsAlt", "gpsLat", "gpsLng", "isReadyForOperation", olt, "photoHuep", "photoModem", "photoOtdr", pon, "signaturePath", "splitterPort", "pdfPath", "invoiceId") FROM stdin;
\.


--
-- Data for Name: SimpleInstallationItem; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SimpleInstallationItem" (id, "simpleInstallationId", "priceItemId", quantity, "priceAtTime", "bonusAtTime") FROM stdin;
\.


--
-- Data for Name: SopladoInfo; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SopladoInfo" (id, "addressId", meters, tk, "tubeColor", "failureReason", photos, "createdAt", "updatedAt", "isSaturday", "teamId", "saturdayPay", "invoiceId", "performerIds") FROM stdin;
a0fb42e8-00da-42aa-8d17-3815dc70a399	c54b8b8d-ca19-4000-8664-cc9a64f996b6	150	TK-123	Rojo	\N	{}	2026-04-03 15:45:56.665	2026-04-03 15:45:56.665	f	\N	0	\N	\N
9089d5da-eb61-4f15-9a3d-1917ec2d3650	8418ae42-8f6d-403c-b67f-24cf49fd3827	160	TK-123	Rojo	\N	{}	2026-04-03 15:45:56.668	2026-04-03 15:45:56.668	f	\N	0	\N	\N
9fc23577-a47b-442a-b5bc-a3384f667a8f	e6669158-ceca-4f42-b1ed-05085dc073cf	170	TK-123	Rojo	\N	{}	2026-04-03 15:45:56.67	2026-04-03 15:45:56.67	f	\N	0	\N	\N
4ee5e64f-2183-4b82-a7f6-cbbbe06245ef	9ebbeeb4-be5d-4585-a562-60bba9766870	180	TK-123	Rojo	\N	{}	2026-04-03 15:45:56.672	2026-04-03 15:45:56.672	f	\N	0	\N	\N
618e9b5f-dcac-49da-9679-9e400f045939	3b93f9a8-11f5-40d6-953b-302afd05dc2f	190	TK-123	Rojo	\N	{}	2026-04-03 15:45:56.673	2026-04-03 15:45:56.673	f	\N	0	\N	\N
\.


--
-- Data for Name: SystemSettings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SystemSettings" (id, "extraPointPrice", "saturdayPointPrice", "monthlyTargetPoints", "updatedAt", "bp2FamPoints", "bpPoints", "brMultiPoints", "mduPoints", "sduPoints", "spPoints", "taPoints", financials, "isDemo", "repairPrice") FROM stdin;
019b879d-3b4d-4a72-8ce4-82994b913aa9	0	0	100	2026-02-19 16:11:32.02	15	10	20	30	25	5	0.5	{"blowers": {"car": 400, "gas": 300, "salary": 1600, "insurance": 352, "materials": 50, "bonusPerUnit": 0.05, "dietasPerDay": 0, "pricePerUnit": 0.4, "saturdayRate": 40, "equipmentRent": 0}, "backOffice": {"salary": 1500, "insurance": 330, "dietasPerDay": 0, "opCostPerPerson": 200, "pricePerAppointment": 15}, "installers": {"car": 400, "gas": 400, "salary": 3200, "insurance": 1334, "materials": 150, "bonusPerTA": 10, "pricePerSP": 75, "pricePerTA": 50, "bonusPerMDU": 10, "pricePerMDU": 50, "bonusPerUnit": 20, "dietasPerDay": 28, "pricePerUnit": 250, "saturdayRate": 40, "bonusPerMulti": 10, "equipmentRent": 1200, "pricePerMulti": 100}}	f	45
c34b5e61-1428-4248-bb95-33ffcbaf0f71	2.5	5	120	2026-04-03 15:45:56.646	15	10	20	30	25	5	0.5	{"carCost": 350, "insurance": 100, "salaryBase": 1700}	t	45
\.


--
-- Data for Name: Team; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Team" (id, name, department, "createdAt", "updatedAt", "isDemo", "activeClientCompanyId", "vehicleId") FROM stdin;
team-instaladores-a	Instaladores A	ACTIVATION	2026-02-19 16:37:17.087	2026-04-06 09:08:55.039	f	77b89ff3-c77a-481b-94b3-62109b6e4b11	\N
73b38b95-f1ec-46c2-a302-209846c6c414	Equipo Demo Alpha	ACTIVATION	2026-04-03 15:45:56.65	2026-04-06 09:08:55.039	t	77b89ff3-c77a-481b-94b3-62109b6e4b11	\N
\.


--
-- Data for Name: Tool; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Tool" (id, name, "serialNumber", status, "teamId", photos, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."User" (id, username, password, role, "teamId", "createdAt", "updatedAt", phone, "baseSalary", "isDemo", "vacationDaysTotal", "activeClientCompanyId") FROM stdin;
60bd89c0-033f-4343-91dd-72947953574d	admin	$2b$10$FEQ6q4SYxdFdinOhB0UFle9iL1YbpcC8m.iVTKzQR1E1PIgn25gMa	SUPER_ADMIN	\N	2026-02-19 16:11:58.085	2026-04-06 09:08:55.042	\N	3200	f	30	77b89ff3-c77a-481b-94b3-62109b6e4b11
f58842b1-d83b-4a41-8165-8b16145116f4	tecnico1	$2b$10$wRXkHBRcqgAA7Gaui0y02e87bqoY/6Xhtu/yrDIzxsQ7FQCSyX.c2	ACTIVATOR	team-instaladores-a	2026-02-19 16:37:17.08	2026-04-06 09:08:55.042	\N	1500	f	30	77b89ff3-c77a-481b-94b3-62109b6e4b11
a7862546-b33e-43ae-9dcb-d7febebd4790	DEMO	$2b$10$XYsH2Yrbe6BGzruin9KRVeoPDOHZfJoq/7FTsco2Slc.9fVWyPTFi	SUPER_ADMIN	\N	2026-04-03 15:45:56.636	2026-04-06 09:08:55.042	\N	1500	t	30	77b89ff3-c77a-481b-94b3-62109b6e4b11
69c952e3-dd83-4acc-8b9f-078b41c6a4b4	hans_demo	$2b$10$XYsH2Yrbe6BGzruin9KRVeoPDOHZfJoq/7FTsco2Slc.9fVWyPTFi	ACTIVATOR	73b38b95-f1ec-46c2-a302-209846c6c414	2026-04-03 15:45:56.652	2026-04-06 09:08:55.042	\N	1600	t	30	77b89ff3-c77a-481b-94b3-62109b6e4b11
e8916513-8599-4b1d-9b17-454d64e9c3a4	sophie_demo	$2b$10$XYsH2Yrbe6BGzruin9KRVeoPDOHZfJoq/7FTsco2Slc.9fVWyPTFi	ACTIVATOR	73b38b95-f1ec-46c2-a302-209846c6c414	2026-04-03 15:45:56.654	2026-04-06 09:08:55.042	\N	1600	t	30	77b89ff3-c77a-481b-94b3-62109b6e4b11
335306cf-b711-4c72-8727-68462982f5b4	Jane Orden	$2b$10$sP0qE22HNLfPC6rb0fYMs.iHFOTVSeK9KxXg/DVqvNhLbM7yZjVVi	SUPER_ADMIN	\N	2026-04-03 15:56:08.577	2026-04-06 09:08:55.042	\N	2500	f	30	77b89ff3-c77a-481b-94b3-62109b6e4b11
323c9f64-a0a3-4240-89c3-5103161c7c77	Alex Wildman	$2b$10$luFmHXZ4WgGAVLyH4iGN5.awbTTwbYHhXaJqk2sZNnE5H8649MzFS	ACTIVATOR	\N	2026-04-03 15:47:06.547	2026-04-06 09:08:55.042	\N	1600	t	30	77b89ff3-c77a-481b-94b3-62109b6e4b11
7c63aba1-377d-4f16-9da9-20c66620bf9f	Alvaro	$2b$10$luFmHXZ4WgGAVLyH4iGN5.awbTTwbYHhXaJqk2sZNnE5H8649MzFS	ACTIVATOR	\N	2026-04-03 15:59:35.629	2026-04-06 09:08:55.042	\N	1600	f	30	77b89ff3-c77a-481b-94b3-62109b6e4b11
89b7f088-99af-4eb0-9758-a5fcab23d9fc	David	$2b$10$luFmHXZ4WgGAVLyH4iGN5.awbTTwbYHhXaJqk2sZNnE5H8649MzFS	ACTIVATOR	\N	2026-04-03 15:59:35.631	2026-04-06 09:08:55.042	\N	1600	f	30	77b89ff3-c77a-481b-94b3-62109b6e4b11
c8825302-fce5-41c2-9199-89ebede6c01b	Erick	$2b$10$luFmHXZ4WgGAVLyH4iGN5.awbTTwbYHhXaJqk2sZNnE5H8649MzFS	ACTIVATOR	\N	2026-04-03 15:59:35.632	2026-04-06 09:08:55.042	\N	1600	f	30	77b89ff3-c77a-481b-94b3-62109b6e4b11
8d1726a6-8c45-4b02-908b-92d7fc529869	Damaris	$2b$10$luFmHXZ4WgGAVLyH4iGN5.awbTTwbYHhXaJqk2sZNnE5H8649MzFS	ACTIVATOR	\N	2026-04-03 15:59:35.632	2026-04-06 09:08:55.042	\N	1600	f	30	77b89ff3-c77a-481b-94b3-62109b6e4b11
5bc4587d-0432-408f-905f-af8868f06a89	admin_joa	$2b$10$l8iu/o4GQA11Dce/BxPNFeUsvK6pnOFXbH16jEHg7XBzLv34zOObO	SUPER_ADMIN	\N	2026-04-03 16:06:48.553	2026-04-06 09:08:55.042	\N	3000	f	30	77b89ff3-c77a-481b-94b3-62109b6e4b11
\.


--
-- Data for Name: VacationRequest; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."VacationRequest" (id, "userId", "startDate", "endDate", type, status, reason, "managerComment", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Vehicle; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Vehicle" (id, make, model, plate, "initialKms", "currentKms", "annualKmLimit", "isDemo", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: VehicleLog; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."VehicleLog" (id, "vehicleId", type, kms, amount, liters, photos, "createdById", "createdAt", "updatedAt", date) FROM stdin;
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
1179cfb3-64d2-49cf-8300-5473453a2d09	dee45baf25838545c81fbbd6e778f690001951dc0719397863a2fe9b9f9559e8	2026-02-19 16:49:55.246388+01	20251203165341_init	\N	\N	2026-02-19 16:49:55.184996+01	1
5dc156b0-99eb-45fd-9295-ce9a7359212e	5179b4a4a74c69fcbbc33cc504bc63f4a2221342022a28fc1d4e8f730091acf8	2026-02-19 16:49:55.251532+01	20251205140517_add_activation_details	\N	\N	2026-02-19 16:49:55.246948+01	1
78f1af6b-6767-4f01-b724-e9e06af8d59e	b3753f47025e2ad9ff9a124b8979ef1a6bb10bba7e997b3266b45137b333129c	2026-02-19 16:49:55.263211+01	20251205180801_add_cascades	\N	\N	2026-02-19 16:49:55.252006+01	1
d27ab717-66c8-44a9-8c98-3ec468d220e2	da9bcae8f8637af0ee3be3c0662370ea96b1a9a48ec3dbe339250bd4a9f12b2c	2026-02-19 16:49:55.265856+01	20251206201139_add_client_name_to_address	\N	\N	2026-02-19 16:49:55.263911+01	1
c2252e22-c909-4f15-8368-55463dab12a0	8f029813dbc98084f459965163a665e86aa45caa91529d9ee972684fdca027c6	2026-02-19 16:49:55.280239+01	20251213090954_add_protocols_and_status	\N	\N	2026-02-19 16:49:55.266364+01	1
a2f61be3-a8ca-4cc2-ba58-6f8a0942d5f7	feb2e24febec6d66f0046ca146de05bf9aeb469d80ba5b90277909a7836fd02b	2026-02-19 16:49:55.286451+01	20251213104426_add_fusion_work	\N	\N	2026-02-19 16:49:55.28069+01	1
d93f8688-0392-457c-add6-a60d1dc90481	43f09c56ce5e6e3cefdf25277bd6fe7cf904eaed3c530c2b875a7cf8e36c79e9	2026-02-19 16:49:55.290256+01	20260126083628_add_is_demo_field	\N	\N	2026-02-19 16:49:55.287163+01	1
54298b8c-8657-4fd1-997f-7c0fe91169ef	9ec694c8dbcff8cfc4d46916edf7aaa8c7e23b0725b1ce0482ab975956ff53f0	2026-02-19 16:49:55.296307+01	20260126090507_add_tool_model	\N	\N	2026-02-19 16:49:55.290787+01	1
17918235-7f0c-4ddc-abe2-a767a781ae53	1188e0dd6a8defb3112b7dd99939debd4331348fcd43fefa1f6de0e8cff75f34	2026-02-19 16:49:55.298323+01	20260212120000_add_repair_price	\N	\N	2026-02-19 16:49:55.296754+01	1
db7bbb2c-b781-487f-98cd-b31fcb635c5a	65940231aea5811d26dbe211ad26aa86f9388aae8bcd4f8d0b4ac14c161980f4	2026-02-19 16:49:56.528671+01	20260219154956_add_new_financial_fields	\N	\N	2026-02-19 16:49:56.44537+01	1
de8de8fb-ae19-48e0-b399-9ef9d96f6c1a	f312bd0d13b827ccc6b8869fd1d5875383fd62e442ec614ea44f3c6cb9399993	2026-02-20 16:53:53.34403+01	20260220155353_add_vacations	\N	\N	2026-02-20 16:53:53.219171+01	1
\.


--
-- Name: ActivationInfo ActivationInfo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ActivationInfo"
    ADD CONSTRAINT "ActivationInfo_pkey" PRIMARY KEY (id);


--
-- Name: Address Address_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Address"
    ADD CONSTRAINT "Address_pkey" PRIMARY KEY (id);


--
-- Name: Appointment Appointment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Appointment"
    ADD CONSTRAINT "Appointment_pkey" PRIMARY KEY (id);


--
-- Name: ClientCompany ClientCompany_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ClientCompany"
    ADD CONSTRAINT "ClientCompany_pkey" PRIMARY KEY (id);


--
-- Name: ClientPriceItem ClientPriceItem_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ClientPriceItem"
    ADD CONSTRAINT "ClientPriceItem_pkey" PRIMARY KEY (id);


--
-- Name: Comment Comment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_pkey" PRIMARY KEY (id);


--
-- Name: CompanySettings CompanySettings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CompanySettings"
    ADD CONSTRAINT "CompanySettings_pkey" PRIMARY KEY (id);


--
-- Name: DietaLog DietaLog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DietaLog"
    ADD CONSTRAINT "DietaLog_pkey" PRIMARY KEY (id);


--
-- Name: FusionInfo FusionInfo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FusionInfo"
    ADD CONSTRAINT "FusionInfo_pkey" PRIMARY KEY (id);


--
-- Name: FusionWork FusionWork_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FusionWork"
    ADD CONSTRAINT "FusionWork_pkey" PRIMARY KEY (id);


--
-- Name: Invoice Invoice_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_pkey" PRIMARY KEY (id);


--
-- Name: MaterialOrder MaterialOrder_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MaterialOrder"
    ADD CONSTRAINT "MaterialOrder_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: PayrollLog PayrollLog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PayrollLog"
    ADD CONSTRAINT "PayrollLog_pkey" PRIMARY KEY (id);


--
-- Name: Project Project_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_pkey" PRIMARY KEY (id);


--
-- Name: PushSubscription PushSubscription_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PushSubscription"
    ADD CONSTRAINT "PushSubscription_pkey" PRIMARY KEY (id);


--
-- Name: Repair Repair_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Repair"
    ADD CONSTRAINT "Repair_pkey" PRIMARY KEY (id);


--
-- Name: SimpleInstallationItem SimpleInstallationItem_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SimpleInstallationItem"
    ADD CONSTRAINT "SimpleInstallationItem_pkey" PRIMARY KEY (id);


--
-- Name: SimpleInstallation SimpleInstallation_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SimpleInstallation"
    ADD CONSTRAINT "SimpleInstallation_pkey" PRIMARY KEY (id);


--
-- Name: SopladoInfo SopladoInfo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SopladoInfo"
    ADD CONSTRAINT "SopladoInfo_pkey" PRIMARY KEY (id);


--
-- Name: SystemSettings SystemSettings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SystemSettings"
    ADD CONSTRAINT "SystemSettings_pkey" PRIMARY KEY (id);


--
-- Name: Team Team_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Team"
    ADD CONSTRAINT "Team_pkey" PRIMARY KEY (id);


--
-- Name: Tool Tool_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Tool"
    ADD CONSTRAINT "Tool_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: VacationRequest VacationRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."VacationRequest"
    ADD CONSTRAINT "VacationRequest_pkey" PRIMARY KEY (id);


--
-- Name: VehicleLog VehicleLog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."VehicleLog"
    ADD CONSTRAINT "VehicleLog_pkey" PRIMARY KEY (id);


--
-- Name: Vehicle Vehicle_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Vehicle"
    ADD CONSTRAINT "Vehicle_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: ActivationInfo_addressId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ActivationInfo_addressId_key" ON public."ActivationInfo" USING btree ("addressId");


--
-- Name: Appointment_addressId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Appointment_addressId_key" ON public."Appointment" USING btree ("addressId");


--
-- Name: ClientCompany_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ClientCompany_name_key" ON public."ClientCompany" USING btree (name);


--
-- Name: DietaLog_userId_date_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "DietaLog_userId_date_key" ON public."DietaLog" USING btree ("userId", date);


--
-- Name: FusionInfo_addressId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "FusionInfo_addressId_key" ON public."FusionInfo" USING btree ("addressId");


--
-- Name: Invoice_number_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Invoice_number_key" ON public."Invoice" USING btree (number);


--
-- Name: PayrollLog_userId_month_year_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "PayrollLog_userId_month_year_key" ON public."PayrollLog" USING btree ("userId", month, year);


--
-- Name: Project_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Project_name_key" ON public."Project" USING btree (name);


--
-- Name: PushSubscription_endpoint_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON public."PushSubscription" USING btree (endpoint);


--
-- Name: SimpleInstallation_addressId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "SimpleInstallation_addressId_key" ON public."SimpleInstallation" USING btree ("addressId");


--
-- Name: SopladoInfo_addressId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "SopladoInfo_addressId_key" ON public."SopladoInfo" USING btree ("addressId");


--
-- Name: Team_vehicleId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Team_vehicleId_key" ON public."Team" USING btree ("vehicleId");


--
-- Name: User_username_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_username_key" ON public."User" USING btree (username);


--
-- Name: Vehicle_plate_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Vehicle_plate_key" ON public."Vehicle" USING btree (plate);


--
-- Name: ActivationInfo ActivationInfo_addressId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ActivationInfo"
    ADD CONSTRAINT "ActivationInfo_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES public."Address"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ActivationInfo ActivationInfo_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ActivationInfo"
    ADD CONSTRAINT "ActivationInfo_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Address Address_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Address"
    ADD CONSTRAINT "Address_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Appointment Appointment_addressId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Appointment"
    ADD CONSTRAINT "Appointment_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES public."Address"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Appointment Appointment_assignedTeamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Appointment"
    ADD CONSTRAINT "Appointment_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Appointment Appointment_scheduledById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Appointment"
    ADD CONSTRAINT "Appointment_scheduledById_fkey" FOREIGN KEY ("scheduledById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ClientPriceItem ClientPriceItem_clientCompanyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ClientPriceItem"
    ADD CONSTRAINT "ClientPriceItem_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES public."ClientCompany"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Comment Comment_appointmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES public."Appointment"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DietaLog DietaLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DietaLog"
    ADD CONSTRAINT "DietaLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FusionInfo FusionInfo_addressId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FusionInfo"
    ADD CONSTRAINT "FusionInfo_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES public."Address"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FusionWork FusionWork_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FusionWork"
    ADD CONSTRAINT "FusionWork_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: FusionWork FusionWork_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FusionWork"
    ADD CONSTRAINT "FusionWork_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Invoice Invoice_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."ClientCompany"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MaterialOrder MaterialOrder_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MaterialOrder"
    ADD CONSTRAINT "MaterialOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Notification Notification_addressId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES public."Address"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PayrollLog PayrollLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PayrollLog"
    ADD CONSTRAINT "PayrollLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Project Project_clientCompanyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES public."ClientCompany"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PushSubscription PushSubscription_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PushSubscription"
    ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Repair Repair_addressId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Repair"
    ADD CONSTRAINT "Repair_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES public."Address"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SimpleInstallationItem SimpleInstallationItem_priceItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SimpleInstallationItem"
    ADD CONSTRAINT "SimpleInstallationItem_priceItemId_fkey" FOREIGN KEY ("priceItemId") REFERENCES public."ClientPriceItem"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SimpleInstallationItem SimpleInstallationItem_simpleInstallationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SimpleInstallationItem"
    ADD CONSTRAINT "SimpleInstallationItem_simpleInstallationId_fkey" FOREIGN KEY ("simpleInstallationId") REFERENCES public."SimpleInstallation"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SimpleInstallation SimpleInstallation_addressId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SimpleInstallation"
    ADD CONSTRAINT "SimpleInstallation_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES public."Address"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SimpleInstallation SimpleInstallation_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SimpleInstallation"
    ADD CONSTRAINT "SimpleInstallation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SimpleInstallation SimpleInstallation_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SimpleInstallation"
    ADD CONSTRAINT "SimpleInstallation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SopladoInfo SopladoInfo_addressId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SopladoInfo"
    ADD CONSTRAINT "SopladoInfo_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES public."Address"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SopladoInfo SopladoInfo_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SopladoInfo"
    ADD CONSTRAINT "SopladoInfo_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SopladoInfo SopladoInfo_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SopladoInfo"
    ADD CONSTRAINT "SopladoInfo_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Team Team_activeClientCompanyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Team"
    ADD CONSTRAINT "Team_activeClientCompanyId_fkey" FOREIGN KEY ("activeClientCompanyId") REFERENCES public."ClientCompany"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Team Team_vehicleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Team"
    ADD CONSTRAINT "Team_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES public."Vehicle"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Tool Tool_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Tool"
    ADD CONSTRAINT "Tool_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: User User_activeClientCompanyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_activeClientCompanyId_fkey" FOREIGN KEY ("activeClientCompanyId") REFERENCES public."ClientCompany"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: VacationRequest VacationRequest_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."VacationRequest"
    ADD CONSTRAINT "VacationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: VehicleLog VehicleLog_vehicleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."VehicleLog"
    ADD CONSTRAINT "VehicleLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES public."Vehicle"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict rivu8LKS7qNrkuro7EmoMR6xcT5AhlseFdUQtxXHzpJJj5oIGUEQGjm2QjDe8X8

