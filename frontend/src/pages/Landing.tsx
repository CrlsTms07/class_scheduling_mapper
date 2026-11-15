import type { ReactNode } from "react";
import { CalendarSearch, ExternalLink, LogIn, Mail, MapPin, Phone, Printer, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { API_URL } from "@/api/client";
import { usePublicSchool } from "@/api/guest";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LOGO = "/ercihs-logo.png";

const Feature = ({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) => (
  <div className="rounded-xl border border-[#790D16]/15 bg-white/90 p-5 shadow-sm">
    <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-[#790D16]/10 text-[#790D16]">{icon}</div>
    <p className="font-semibold text-neutral-900">{title}</p>
    <p className="mt-1 text-sm text-neutral-700">{children}</p>
  </div>
);

const Contact = ({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) => (
  <div className="flex gap-3">
    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#790D16] text-white">{icon}</div>
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#790D16]">{label}</p>
      <div className="break-words text-sm text-neutral-800">{children}</div>
    </div>
  </div>
);

/**
 * The first page everyone sees: who the school is, how to reach it, and the two ways in:
 * viewing the posted schedules as a guest, or signing in.
 */
const Landing = () => {
  const { data: school } = usePublicSchool();
  const name = school?.school_name ?? "Emmanuel Resurreccion Congressional Integrated High School";
  const shortName = school?.short_name ?? "ERCIHS";

  return (
    <div className="min-h-dvh bg-white text-neutral-900">
      <header className="sticky top-0 z-20 border-b border-[#790D16]/10 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <Link to="/" className="flex min-h-11 min-w-0 items-center gap-2">
            <img src={LOGO} alt="" className="size-10 shrink-0" />
            <span className="min-w-0">
              <span className="block font-bold leading-tight text-[#790D16]">{shortName}</span>
              <span className="block truncate text-xs text-neutral-600">Scheduling System</span>
            </span>
          </Link>
          <nav className="flex shrink-0 items-center gap-2">
            <Link to="/guest" aria-label="View as Guest" className={cn(buttonVariants({ variant: "outline" }), "h-11 border-[#790D16]/30 text-[#790D16] max-sm:px-3")}>
              <CalendarSearch />
              <span className="max-sm:hidden">View as Guest</span>
              <span className="sm:hidden">Guest</span>
            </Link>
            <Link to="/login" className={cn(buttonVariants(), "h-11 bg-[#790D16] text-white hover:bg-[#790D16]/90 max-sm:px-3")}>
              <LogIn />
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          {/* The school seal, faint, grey and centred behind the page, so the coloured seal stands out. */}
          <img
            src={LOGO}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 w-[30rem] max-w-none -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.045] grayscale sm:w-[44rem]"
          />
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#790D16] via-red-600 to-[#790D16]" />

          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:py-24 landscape:max-lg:py-8">
            <div className="space-y-5">
              <p className="inline-flex items-center gap-2 rounded-full border border-[#790D16]/20 bg-white px-3 py-1 text-xs font-medium text-[#790D16]">
                Department of Education · City of Dasmariñas
              </p>
              <h1 className="text-3xl font-bold leading-tight text-[#790D16] sm:text-4xl lg:text-5xl">{name}</h1>
              {school?.tagline && <p className="text-sm font-semibold tracking-wide text-neutral-700 sm:text-base">{school.tagline}</p>}
              <p className="max-w-xl text-neutral-700">
                Find your section's approved class schedule, no account needed. Teachers and school staff sign in to plan
                and approve schedules.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link to="/guest" className={cn(buttonVariants(), "h-12 bg-[#790D16] px-6 text-base text-white hover:bg-[#790D16]/90")}>
                  <CalendarSearch />
                  View class schedules
                </Link>
                <Link to="/login" className={cn(buttonVariants({ variant: "outline" }), "h-12 border-[#790D16]/30 px-6 text-base text-[#790D16]")}>
                  <LogIn />
                  Sign in
                </Link>
              </div>
            </div>

            <div className="mx-auto w-full max-w-md">
              {school?.has_photo ? (
                <img
                  src={`${API_URL}/api/public/school/photo`}
                  alt={`The campus of ${name}`}
                  className="aspect-[4/3] w-full rounded-2xl object-cover shadow-xl ring-4 ring-white"
                />
              ) : (
                <div className="relative mx-auto flex aspect-square w-64 items-center justify-center rounded-full bg-white shadow-xl ring-8 ring-[#790D16]/10 sm:w-80">
                  <img src={LOGO} alt={`${shortName} seal`} className="w-4/5" />
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="bg-[#790D16]/[0.03] py-12">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:grid-cols-3 sm:px-6">
            <Feature icon={<CalendarSearch className="size-5" />} title="Find your section">
              Pick the department, grade level and section, or search by section or adviser.
            </Feature>
            <Feature icon={<ShieldCheck className="size-5" />} title="Only final schedules">
              Schedules show here once the school approves them, so what you see is what is followed.
            </Feature>
            <Feature icon={<Printer className="size-5" />} title="Print or save">
              Print the class program, save it as PDF, or share its link and QR code.
            </Feature>
          </div>
        </section>

        {(school?.vision || school?.mission || school?.core_values) && (
          <section className="py-12">
            <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 md:grid-cols-3">
              {school.vision && (
                <div>
                  <p className="text-lg font-bold text-[#790D16]">Vision</p>
                  <p className="mt-2 whitespace-pre-line text-sm text-neutral-700">{school.vision}</p>
                </div>
              )}
              {school.mission && (
                <div>
                  <p className="text-lg font-bold text-[#790D16]">Mission</p>
                  <p className="mt-2 whitespace-pre-line text-sm text-neutral-700">{school.mission}</p>
                </div>
              )}
              {school.core_values && (
                <div>
                  <p className="text-lg font-bold text-[#790D16]">Core Values</p>
                  <p className="mt-2 whitespace-pre-line text-sm text-neutral-700">{school.core_values}</p>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="py-12" aria-labelledby="contact-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 id="contact-heading" className="text-xl font-bold text-[#790D16]">
              Contact us
            </h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {school?.address && (
                <Contact icon={<MapPin className="size-5" />} label="Address">
                  {school.address}
                </Contact>
              )}
              {school?.phone && (
                <Contact icon={<Phone className="size-5" />} label="Phone">
                  {school.phone}
                </Contact>
              )}
              {school?.email && (
                <Contact icon={<Mail className="size-5" />} label="Email">
                  <a href={`mailto:${school.email}`} className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">
                    {school.email}
                  </a>
                </Contact>
              )}
              {(school?.facebook_url || school?.website) && (
                <Contact icon={<ExternalLink className="size-5" />} label="Online">
                  <div className="flex flex-col">
                    {school.facebook_url && (
                      <a href={school.facebook_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">
                        Facebook page
                      </a>
                    )}
                    {school.website && (
                      <a href={school.website} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">
                        School website
                      </a>
                    )}
                  </div>
                </Contact>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#790D16] text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-6 text-center sm:flex-row sm:justify-between sm:px-6 sm:text-left">
          <div className="flex items-center gap-3">
            <img src={LOGO} alt="" className="size-10 rounded-full bg-white p-0.5" />
            <p className="text-sm font-medium">{name}</p>
          </div>
          <p className="text-xs text-white/80">
            © {new Date().getFullYear()} {shortName} Scheduling System
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
