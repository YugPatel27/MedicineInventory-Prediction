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
      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row md:justify-between">
        <div>
          <span className="text-primary font-medium">
            Trusted local privacy
          </span>

          <h1 className="mt-4 text-4xl font-bold text-foreground">
            Privacy, Cookies, and Legal Use Policies
          </h1>

          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            MediStock is designed for secure on-premise medicine inventory management.
            This page explains how we handle your preferences, data,
            and cookie consent in a way that aligns with GDPR, CCPA,
            and modern privacy best practices.
          </p>
        </div>

        {/* Quick Links */}
        <div className="grid gap-3 rounded-3xl border border-border bg-background p-4 text-sm">
          <p className="font-semibold text-foreground">Quick Links</p>

          {sections.map((section) => (
            <Link
              key={section.id}
              to={`#${section.id}`}
              className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 transition hover:bg-muted/70 ${
                location.hash === `#${section.id}`
                  ? "bg-primary/10 text-primary"
                  : "bg-muted/10 text-foreground"
              }`}
            >
              <section.icon className="h-4 w-4" />
              {section.title}
            </Link>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
        {/* Sidebar */}
        <aside className="rounded-3xl border border-border bg-background p-6 h-fit">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            What this covers
          </h2>

          <ul className="space-y-3 text-sm text-muted-foreground list-disc pl-5">
            <li>Local-first design</li>
            <li>No external tracking by default</li>
            <li>Cookie consent management</li>
            <li>User rights and compliance</li>
            <li>Responsible deployment guidance</li>
          </ul>
        </aside>

        {/* Sections */}
        <div className="space-y-8">
          {/* Privacy */}
          <section
            id="privacy"
            className="rounded-3xl border border-border bg-background p-6"
          >
            <div className="flex items-center gap-3 text-primary">
              <Shield className="h-5 w-5" />
              <h2 className="text-xl font-semibold">
                Privacy Policy
              </h2>
            </div>

            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              MediStock is a local-first medicine operations platform. Your
              data stays within your deployment environment unless you
              choose to export it. We do not send inventory, login
              credentials, or application data to third-party analytics
              providers by default.
            </p>

            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p>
                When using the app, you may grant consent for optional
                cookies and local preference storage. You can update
                these settings at any time from the Settings page.
              </p>
            </div>
          </section>

          {/* Cookies */}
          <section
            id="cookies"
            className="rounded-3xl border border-border bg-background p-6"
          >
            <div className="flex items-center gap-3 text-sky-500">
              <Cookie className="h-5 w-5" />
              <h2 className="text-xl font-semibold">
                Cookie Use & Consent
              </h2>
            </div>

            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              MediStock uses cookies and local storage only for essential app
              functions and user preferences. Optional cookies are used
              solely to store consent choices and usability preferences
              within your browser.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-muted/20 p-4">
                <p className="text-sm font-semibold text-foreground">
                  Essential Cookies
                </p>

                <p className="mt-2 text-sm text-muted-foreground">
                  Required for login sessions, theme selection, and
                  saved preferences.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/20 p-4">
                <p className="text-sm font-semibold text-foreground">
                  Optional Cookies
                </p>

                <p className="mt-2 text-sm text-muted-foreground">
                  Used for consent tracking and user preference
                  management only, without external analytics
                  collection.
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              You can accept all cookies, choose necessary-only, or
              decline optional cookies. The banner will remain available
              until you make a choice.
            </p>
          </section>

          {/* Terms */}
          <section
            id="terms"
            className="rounded-3xl border border-border bg-background p-6"
          >
            <div className="flex items-center gap-3 text-cyan-600">
              <FileText className="h-5 w-5" />
              <h2 className="text-xl font-semibold">
                Terms of Use
              </h2>
            </div>

            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              By using MediStock, you agree to operate the software
              responsibly and maintain proper credentials. The system is
              provided as-is for internal medicine inventory and
              forecasting purposes and should be deployed on secure
              local infrastructure.
            </p>

            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p>
                MediStock does not collect or process any personal data
                outside your local environment unless you explicitly
                export it or integrate the platform with an external
                service.
              </p>
            </div>
          </section>

          {/* Compliance */}
          <section
            id="compliance"
            className="rounded-3xl border border-border bg-background p-6"
          >
              <div className="flex items-center gap-3 text-sky-500">
              <CheckCircle className="h-5 w-5" />
              <h2 className="text-xl font-semibold">
                Compliance & User Rights
              </h2>
            </div>

            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              MediStock is designed to align with modern privacy standards
              such as GDPR and CCPA by supporting local data control,
              consent management, and transparency.
            </p>

            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p>
                This system is intended for internal operations. It does
                not sell user data and does not share personal
                information outside your deployment unless you
                explicitly export it.
              </p>
            </div>
          </section>

          {/* Footer Card */}
          <div className="rounded-3xl border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <CheckCircle className="h-5 w-5 text-sky-500" />
              Responsible Deployment
            </div>

            <p className="mt-3">
              For the strongest privacy posture, host MediStock on internal
              hardware, restrict access to trusted staff, and use the
              built-in consent controls for browser-based preferences.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}