import LandingImg from "@/assets/login/landingImg.svg";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import HeroLogo from "@/assets/login/hero-logo.png";

type AuthenticationLayoutProp = {
  children: React.ReactElement;
  title: string;
  description: string;
};

const AuthenticationLayout = ({
  children,
  title,
  description,
}: AuthenticationLayoutProp) => {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-dvh">
        <div className="relative flex items-center justify-center px-4 pb-8 pt-16 sm:px-8">
          {/* Back to the landing page, from sign in, sign up and password pages. */}
          <Link
            to="/"
            className="absolute left-3 top-3 inline-flex min-h-11 items-center gap-1 rounded-md px-3 text-sm font-medium text-[#790D16] hover:bg-[#790D16]/5 sm:left-6 sm:top-6"
          >
            <ArrowLeft className="size-4" />
            Back to home
          </Link>
          <div className="w-full max-w-md space-y-6 sm:space-y-8">
            <div className="space-y-3">
              <div className="flex justify-center mb-4">
                <img
                  src={HeroLogo}
                  alt="hero-logo"
                  className="aspect-auto object-center w-16 max-lg:landscape:w-10"
                />
              </div>
              <p className="text-center text-xl font-bold text-[#790D16]">
                {title}
              </p>
              <p className="text-center text-sm text-neutral-700">
                {description}
              </p>
            </div>
            <div>{children}</div>
          </div>
        </div>
        <div className="hidden lg:block p-10 bg-mauve-100">
          <div className="space-y-3 mt-10 p-5">
            <p className="text-3xl font-bold text-center text-[#790D16]">
              ERCIHS Scheduling System
            </p>
            <p className="text-center text-neutral-700">
              Plan classes, assign teachers and rooms, and keep everyone on the
              same timetable.
            </p>
            <div className="flex justify-center mt-28">
              <img src={LandingImg} alt="landing-img" className="w-96" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AuthenticationLayout;
