import { UserRound } from "lucide-react";
import { useMyProfile } from "@/api/myRecords";
import { useSelectedTerm } from "@/context/selectedTerm";
import type { MyProfile } from "@/types/api";
import FormAlert from "@/components/global-component/FormAlert";
import { Card, CardContent } from "@/components/ui/card";

const SHIFT_NAMES: Record<MyProfile["shift"], string> = {
  AM: "Morning",
  PM: "Afternoon",
  WHOLE_DAY: "Whole day",
};

const Detail = ({ label, value }: { label: string; value: string | number | null }) => (
  <div>
    <dt className="text-xs text-neutral-700">{label}</dt>
    <dd className="text-sm font-medium text-neutral-900 break-words">{value ?? "Not set"}</dd>
  </div>
);

/** A person's own record, read-only. Corrections go through the Admin or the scheduler. */
const MyProfilePage = () => {
  const { term, isPending: isTermPending } = useSelectedTerm();
  const { data, isPending, isError } = useMyProfile(term?.id);

  return (
    <div className="p-4 sm:p-6 space-y-4 lg:max-w-3xl">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-[#790D16]/20 rounded-sm">
          <UserRound className="text-branding size-5" />
        </div>
        <div>
          <p className="text-branding text-xl font-medium">My Profile</p>
          <p className="text-sm text-neutral-700">To correct anything here, please ask the Admin.</p>
        </div>
      </div>

      {!term && (
        <p className="text-sm text-neutral-700">
          {isTermPending ? "Loading..." : "There is no school year yet."}
        </p>
      )}
      {term && isPending && <p className="text-sm text-neutral-600">Loading...</p>}
      {isError && <FormAlert>Your profile could not be loaded.</FormAlert>}

      {data === null && (
        <FormAlert>
          Your account is not linked to a personnel record yet. Please ask the Admin to link it.
        </FormAlert>
      )}

      {term && data && (
        <>
          <Card>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Detail label="Name" value={data.printed_name} />
                <Detail label="Email" value={data.email} />
                <Detail label="Department" value={data.department} />
                <Detail label="Designation" value={data.designation} />
                <Detail label="Shift" value={SHIFT_NAMES[data.shift]} />
                <Detail label="Advisory" value={data.advisory ?? "None"} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <p className="font-medium text-teal-700">
                {term.name}, SY {term.school_year.name}
              </p>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Detail label="Subjects assigned" value={`${data.assigned} of ${data.max_subjects} at most`} />
                <Detail label="Other tasks" value={data.tasks.length > 0 ? data.tasks.join(", ") : "None"} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <p className="font-medium text-teal-700">Educational qualifications</p>
              {data.qualifications.length === 0 ? (
                <p className="text-sm text-neutral-700">None encoded yet.</p>
              ) : (
                <ul className="divide-y">
                  {data.qualifications.map((item, index) => (
                    <li key={index} className="py-2 text-sm first:pt-0 last:pb-0">
                      <p className="font-medium text-neutral-900">
                        {item.degree}
                        {item.major && `, major in ${item.major}`}
                      </p>
                      <p className="text-xs text-neutral-700">
                        {[item.degree_level, item.school, item.year_completed].filter(Boolean).join(" · ")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default MyProfilePage;
