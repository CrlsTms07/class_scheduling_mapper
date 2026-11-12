import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useAddLogo, useRemoveLogo, useRemovePhoto, useSavePhoto, useSaveProfile, useSetLogoPlacement } from "@/api/reportSettings";
import { API_URL } from "@/api/client";
import { apiErrorMessage } from "@/lib/forms";
import { emptyToNull, ProfileSchema, type ProfileValues } from "@/lib/reportSettings";
import type { ReportSettings } from "@/types/api";
import FormAlert from "@/components/global-component/FormAlert";
import FormTextField from "@/components/global-component/FormTextField";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

const FIELDS: { name: keyof ProfileValues; label: string; type?: "email" }[] = [
  { name: "school_name", label: "School name" },
  { name: "school_id", label: "DepEd School ID (optional)" },
  { name: "address", label: "Address (optional)" },
  { name: "phone", label: "Telephone (optional)" },
  { name: "email", label: "Email (optional)", type: "email" },
  { name: "website", label: "Website (optional)" },
  { name: "region", label: "Region, on the forms (optional)" },
  { name: "division", label: "Schools division, on the forms (optional)" },
  { name: "facebook_url", label: "Facebook page link (optional)" },
  { name: "tagline", label: "Tagline on the home page (optional)" },
  { name: "core_values", label: "Core values (optional)" },
];

/** Longer texts shown on the home page. */
const LONG_FIELDS: { name: "vision" | "mission"; label: string }[] = [
  { name: "vision", label: "Vision (optional)" },
  { name: "mission", label: "Mission (optional)" },
];

const SchoolProfilePanel = ({ settings }: { settings: ReportSettings }) => {
  const save = useSaveProfile();
  const addLogo = useAddLogo();
  const removeLogo = useRemoveLogo();
  const placeLogo = useSetLogoPlacement();
  const savePhoto = useSavePhoto();
  const removePhoto = useRemovePhoto();
  const fileInput = React.useRef<HTMLInputElement>(null);
  const photoInput = React.useRef<HTMLInputElement>(null);
  // A new address each time, so the browser shows the photo just uploaded.
  const [photoVersion, setPhotoVersion] = React.useState(0);
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
      region: school?.region ?? "",
      division: school?.division ?? "",
      facebook_url: school?.facebook_url ?? "",
      tagline: school?.tagline ?? "",
      vision: school?.vision ?? "",
      mission: school?.mission ?? "",
      core_values: school?.core_values ?? "",
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
        region: emptyToNull(values.region),
        division: emptyToNull(values.division),
        facebook_url: emptyToNull(values.facebook_url),
        tagline: emptyToNull(values.tagline),
        vision: emptyToNull(values.vision),
        mission: emptyToNull(values.mission),
        core_values: emptyToNull(values.core_values),
      },
      { onSuccess: () => setIsSaved(true) },
    );
  });

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) addLogo.mutate(file);
    event.target.value = ""; // So the same file can be picked again after an error.
  };

  const logoError = addLogo.error ?? removeLogo.error ?? placeLogo.error;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
      <Card className="shadow shadow-[#790D16]/40">
        <CardContent>
          <form noValidate className="space-y-4" onSubmit={handleSave}>
            <p className="font-medium text-teal-700">School details</p>
            <p className="text-xs text-neutral-700">
              These print in the header and footer of every form, and show on the home page.
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
            {LONG_FIELDS.map(({ name, label }) => (
              <div key={name} className="space-y-1">
                <label htmlFor={`profile-${name}`} className="text-sm text-neutral-800">
                  {label}
                </label>
                <Textarea id={`profile-${name}`} rows={3} {...form.register(name)} />
                {form.formState.errors[name] && (
                  <p className="text-xs text-destructive">{form.formState.errors[name]?.message}</p>
                )}
              </div>
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
            Up to {maxLogos}. Choose where each is printed: at the top of the form (the DepEd seal) or small in the footer
            (DepEd, Bagong Pilipinas, the school seal). Use a PNG or JPG of 2 MB or smaller.
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
                <NativeSelect
                  aria-label={`Where logo ${index + 1} is printed`}
                  className="w-full [&_select]:h-11"
                  value={settings.logo_items?.[index]?.placement ?? "header"}
                  disabled={placeLogo.isPending}
                  onChange={(event) => placeLogo.mutate({ index, placement: event.target.value as "header" | "footer" })}
                >
                  <NativeSelectOption value="header">Top of the form</NativeSelectOption>
                  <NativeSelectOption value="footer">Footer</NativeSelectOption>
                </NativeSelect>
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

      <Card className="shadow shadow-[#790D16]/40 xl:col-start-2">
        <CardContent className="space-y-4">
          <p className="font-medium text-teal-700">Photo of the school</p>
          <p className="text-xs text-neutral-700">
            Shown on the home page beside the school name. Use a wide PNG, JPG or WebP of 3 MB or smaller.
          </p>
          {(savePhoto.error ?? removePhoto.error) && <FormAlert>{apiErrorMessage(savePhoto.error ?? removePhoto.error)}</FormAlert>}
          {school?.has_photo ? (
            <img
              src={`${API_URL}/api/public/school/photo?v=${photoVersion}`}
              alt="The school"
              className="aspect-[4/3] w-full rounded-md object-cover"
            />
          ) : (
            <p className="text-sm text-neutral-700">No photo yet. The home page shows the school seal instead.</p>
          )}
          <input
            ref={photoInput}
            type="file"
            accept=".png,.jpg,.jpeg,.webp"
            aria-label="Photo file"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) savePhoto.mutate(file, { onSuccess: () => setPhotoVersion((value) => value + 1) });
              event.target.value = "";
            }}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={!school || savePhoto.isPending}
              onClick={() => photoInput.current?.click()}
            >
              <ImagePlus />
              {savePhoto.isPending ? "Uploading..." : school?.has_photo ? "Replace the photo" : "Add a photo"}
            </Button>
            {school?.has_photo && (
              <Button
                type="button"
                variant="outline"
                className="h-11 text-destructive"
                disabled={removePhoto.isPending}
                onClick={() => removePhoto.mutate(undefined)}
              >
                <Trash2 />
                Remove the photo
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SchoolProfilePanel;
