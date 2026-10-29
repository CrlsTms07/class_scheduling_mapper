import LandingImg from "@/assets/login/landingImg.svg";
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
      <div className="grid grid-cols-2 grid-flow-row ">
        <div className="flex items-center justify-center">
          <div className="space-y-8">
            <div className="mx-36 space-y-3">
              <div className="flex justify-center mb-4">
                <img
                  src={HeroLogo}
                  alt="hero-logo"
                  className="aspect-auto object-center w-16"
                />
              </div>
              <p className="text-center text-xl font-bold text-[#790D16]">
                {title}
              </p>
              <p className="text-center text-sm text-neutral-700">
                {description}
              </p>
            </div>
            <div className="px-24 pt-5">{children}</div>
          </div>
        </div>
        <div className="p-10 bg-mauve-100 h-screen">
          <div className="space-y-3 mt-10 p-5">
            <p className="text-3xl font-bold text-center text-[#790D16]">
              Scheduling Mapper
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
