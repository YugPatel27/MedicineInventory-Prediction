import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import {
  ShieldCheck as Shield,
  Sparkles as Cookie,
  FileText,
  CheckCircle2 as CheckCircle,
} from "../components/Icons";

const sections = [
  {
    id: "privacy",
    title: "Privacy Policy",
    icon: Shield,
  },
  {
    id: "cookies",
    title: "Cookies",
    icon: Cookie,
  },
  {
    id: "terms",
    title: "Terms of Use",
    icon: FileText,
  },
  {
    id: "compliance",
    title: "Compliance",
    icon: CheckCircle,
  },
];

export function Legal() {
  const location = useLocation();

  useEffect(() => {
    document.title = "Privacy & Legal — MediStock";
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">
      <div>
        <span className="text-primary font-medium">Trusted local privacy</span>
        <h1 className="mt-4 text-4xl font-bold text-foreground">Privacy, Consent & Transparency</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          MediStock is a local-first medicine inventory and forecasting platform. Below we explain, in plain language, what data we collect,
          how it is stored, how consent is handled, and the options you have as an administrator or user to control data and privacy.
        </p>
      </div>

      <div className="grid gap-6">
        <section className="rounded-3xl border border-border bg-background p-6">
          <h2 className="text-xl font-semibold mb-2">What data is stored</h2>
          <p className="text-sm text-muted-foreground leading-7">
            MediStock stores inventory records, medicine meta (ID, name, batch numbers), stock movements, and user accounts required to operate the system.
            All application data is stored on the infrastructure you deploy (local disk, private server, or private cloud) and is not transmitted to
            third-party analytics providers by default.
          </p>
        </section>

        <section className="rounded-3xl border border-border bg-background p-6">
          <h2 className="text-xl font-semibold mb-2">How we use the data</h2>
          <p className="text-sm text-muted-foreground leading-7">
            Data is used to provide inventory visibility, expiry alerts, batch segmentation (FEFO), and forecasting features such as seasonal demand predictions.
            Exports (CSV/PDF) are generated on-demand and, when downloaded, will be stored wherever you save them. Integrations or external exports only occur if you
            explicitly configure and enable them.
          </p>
        </section>

        <section className="rounded-3xl border border-border bg-background p-6">
          <h2 className="text-xl font-semibold mb-2">Consent & Cookies</h2>
          <p className="text-sm text-muted-foreground leading-7">
            The application uses cookies/localStorage for session management and to remember UI preferences. Optional cookies are only used to persist
            choices such as theme preference and cookie consent and are stored locally in the browser. You can clear stored preferences from the Settings page
            or by clearing your browser storage.
          </p>
        </section>

        <section className="rounded-3xl border border-border bg-background p-6">
          <h2 className="text-xl font-semibold mb-2">User rights & control</h2>
          <p className="text-sm text-muted-foreground leading-7">
            As an administrator you can export, delete, or anonymize records using the admin tools. User accounts can be disabled or removed via the Users page.
            If you need assistance with data extraction or secure deletion, please contact your system operator.
          </p>
        </section>

        <section className="rounded-3xl border border-border bg-background p-6">
          <h2 className="text-xl font-semibold mb-2">Transparency & Security</h2>
          <p className="text-sm text-muted-foreground leading-7">
            MediStock encourages deployment on secure internal networks and recommends restricting access to authorized personnel. Keep backups encrypted
            and rotate administrative credentials regularly. For full security guidance, consult your IT policies and the project README for deployment notes.
          </p>
        </section>
      </div>
    </div>
  );
}