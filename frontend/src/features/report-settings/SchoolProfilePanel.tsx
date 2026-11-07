import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useAddLogo, useRemoveLogo, useSaveProfile } from "@/api/reportSettings";
import { apiErrorMessage } from "@/lib/forms";
import { emptyToNull, ProfileSchema, type ProfileValues } from "@/lib/reportSettings";
import type { ReportSettings } from "@/types/api";
import FormAlert from "@/components/global-component/FormAlert";
import FormTextField from "@/components/global-component/FormTextField";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const FIELDS: { name: keyof ProfileValues; label: string; type?: "email" }[] = [
  { name: "school_name", label: "School name" },
  { name: "school_id", label: "DepEd School ID (optional)" },
  { name: "address", label: "Address (optional)" },
  { name: "phone", label: "Telephone (optional)" },
  { name: "email", label: "Email (optional)", type: "email" },
  { name: "website", label: "Website (optional)" },
];

const SchoolProfilePanel = ({ settings }: { settings: ReportSettings }) => {
  const save = useSaveProfile();
  const addLogo = useAddLogo();
  const removeLogo = useRemoveLogo();
  const fileInput = React.useRef<HTMLInputElement>(null);
  const [isSaved, setIsSaved] = React.useState(false);

  const { school, logos, max_logos: maxLogos } = settings;

  const form = useForm<ProfileValues>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: {
      school_name: school?.school_name ?? "",
      school_id: school?.school_id ?? "",
      address: school?.address ?? "",
      phone: school?.phone ?? "",
      email: school?.email ?? "",
      website: school?.website ?? "",
    },
  });

  const handleSave = form.handleSubmit((values) => {
    setIsSaved(false);
    save.mutate(
      {
        school_name: values.school_name,
        school_id: emptyToNull(values.school_id),
        address: emptyToNull(values.address),
        phone: emptyToNull(values.phone),
        email: emptyToNull(values.email),
        website: emptyToNull(values.website),
      },
      { onSuccess: () => setIsSaved(true) },
    );
  });

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) addLogo.mutate(file);
    event.target.value = ""; // So the same file can be picked again after an error.
  };

  const logoError = addLogo.error ?? removeLogo.error;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
      <Card className="shadow shadow-[#790D16]/40">
        <CardContent>
          <form noValidate className="space-y-4" onSubmit={handleSave}>
            <p className="font-medium text-teal-700">School details</p>
            <p className="text-xs text-neutral-700">
              These print in the header and footer of every form.
            </p>
            {save.isError && <FormAlert>{apiErrorMessage(save.error)}</FormAlert>}
            {isSaved && <FormAlert variant="success">The school details were saved.</FormAlert>}
            {FIELDS.map(({ name, label, type }) => (
              <FormTextField
                key={name}
                control={form.control}
                name={name}
                label={label}
                type={type}
              />
            ))}
            <Button type="submit" className="h-11 w-full" disabled={save.isPending}>
              {save.isPending ? "Saving..." : "Save school details"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow shadow-[#790D16]/40">
        <CardContent className="space-y-4">
          <p className="font-medium text-teal-700">Logos</p>
          <p className="text-xs text-neutral-700">
            Up to {maxLogos}, printed side by side at the top of the form in this order. Use a PNG
            or JPG of 2 MB or smaller.
          </p>
          {logoError && <FormAlert>{apiErrorMessage(logoError)}</FormAlert>}

          {logos.length === 0 && (
            <p className="text-sm text-neutral-700">There are no logos yet.</p>
          )}

          <ul className="grid grid-cols-2 gap-3">
            {logos.map((logo, index) => (
              <li key={logo} className="space-y-2 rounded-md border p-2">
                <img
                  src={logo}
                  alt={`Logo ${index + 1}`}
                  className="mx-auto h-20 w-full object-contain"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full text-destructive"
                  aria-label={`Remove logo ${index + 1}`}
                  disabled={removeLogo.isPending}
                  onClick={() => removeLogo.mutate(index)}
                >
                  <Trash2 />
                  Remove
                </Button>
              </li>
            ))}
          </ul>

          <input
            ref={fileInput}
            type="file"
            accept=".png,.jpg,.jpeg"
            aria-label="Logo file"
            className="hidden"
            onChange={handleFile}
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            disabled={logos.length >= maxLogos || !school || addLogo.isPending}
            onClick={() => fileInput.current?.click()}
          >
            <ImagePlus />
            {addLogo.isPending ? "Uploading..." : "Add a logo"}
          </Button>
          {!school && (
            <p className="text-xs text-neutral-700">Save the school details first.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SchoolProfilePanel;
