"use client";

import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  createSource,
  testSourceConnection,
  updateSource,
} from "@/features/sources/actions";
import { getProvider, PROVIDERS } from "@/features/sources/lib/providers";
import {
  type SourceFormValues,
  sourceInputSchema,
  sourceUpdateSchema,
} from "@/features/sources/lib/schema";
import { FormAlert } from "@/forms/components/form-alert";
import { useAppForm } from "@/forms/form";

type TestStatus =
  | { state: "idle" }
  | { state: "testing" }
  | { state: "ok" }
  | { state: "failed"; message: string };

interface SourceFormProps {
  onSuccess: () => void;
  /** When set, the form edits an existing source instead of creating one. */
  edit?: { sourceId: string; initialValues: SourceFormValues };
}

export function SourceForm({ onSuccess, edit }: SourceFormProps) {
  const [serverError, setServerError] = useState<string>();
  const [test, setTest] = useState<TestStatus>({ state: "idle" });

  const form = useAppForm({
    defaultValues: edit?.initialValues ?? {
      name: "",
      provider: PROVIDERS[0].id,
      endpoint: "",
      bucket: "",
      accessKeyId: "",
      secretAccessKey: "",
      allowUpload: false,
      allowDelete: false,
    },
    validators: {
      // Same schemas as the server actions — errors map onto the fields.
      onChange: edit ? sourceUpdateSchema : sourceInputSchema,
    },
    listeners: {
      // Any edit invalidates a previous connection test result.
      onChange: () => setTest({ state: "idle" }),
    },
    onSubmit: async ({ value }) => {
      setServerError(undefined);
      const result = edit
        ? await updateSource(edit.sourceId, value)
        : await createSource(value);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      toast.success(edit ? "Source updated" : "Source added");
      onSuccess();
    },
  });

  const handleTest = async () => {
    setServerError(undefined);
    setTest({ state: "testing" });
    const result = await testSourceConnection(
      form.state.values,
      edit?.sourceId,
    );
    setTest(
      result.ok ? { state: "ok" } : { state: "failed", message: result.error },
    );
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
      className="space-y-4"
    >
      <form.AppField name="provider">
        {(field) => (
          <field.SelectField
            label="Provider"
            options={PROVIDERS.map(({ id, label }) => ({ value: id, label }))}
            placeholder="Select a provider"
          />
        )}
      </form.AppField>

      <form.AppField name="name">
        {(field) => (
          <field.TextField
            label="Name"
            placeholder="Team documents"
            autoFocus={!edit}
          />
        )}
      </form.AppField>

      {/* Credential fields use the selected provider's vocabulary. */}
      <form.Subscribe selector={(state) => state.values.provider}>
        {(providerId) => {
          const provider = getProvider(providerId) ?? PROVIDERS[0];
          const { bucket, accessKeyId, secretAccessKey } = provider.fieldLabels;
          return (
            <>
              <form.AppField name="endpoint">
                {(field) => (
                  <field.TextField
                    label="Endpoint"
                    placeholder={provider.endpointPlaceholder}
                    mono
                  />
                )}
              </form.AppField>

              <form.AppField name="bucket">
                {(field) => <field.TextField label={bucket} mono />}
              </form.AppField>

              <form.AppField name="accessKeyId">
                {(field) => <field.TextField label={accessKeyId} mono />}
              </form.AppField>

              <form.AppField name="secretAccessKey">
                {(field) => (
                  <field.TextField
                    label={secretAccessKey}
                    type="password"
                    placeholder={
                      edit ? "Leave blank to keep the current one" : undefined
                    }
                    mono
                  />
                )}
              </form.AppField>
            </>
          );
        }}
      </form.Subscribe>

      <fieldset className="space-y-3 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">Permissions</legend>
        <form.AppField name="allowUpload">
          {(field) => (
            <field.SwitchField
              label="Allow uploads"
              description="Files can be added to this bucket."
            />
          )}
        </form.AppField>
        <form.AppField name="allowDelete">
          {(field) => (
            <field.SwitchField
              label="Allow deletions"
              description="Files can be permanently deleted from this bucket."
            />
          )}
        </form.AppField>
        <p className="text-xs text-muted-foreground">
          Write access applies to anyone who can reach this app — keep both off
          for a read-only source.
        </p>
      </fieldset>

      <FormAlert
        error={test.state === "failed" ? test.message : serverError}
        success={test.state === "ok" ? "Connection successful." : undefined}
      />

      <DialogFooter>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={isSubmitting || test.state === "testing"}
            >
              {test.state === "testing" ? (
                <>
                  <Loader2Icon className="animate-spin" aria-hidden />
                  Testing…
                </>
              ) : (
                "Test connection"
              )}
            </Button>
          )}
        </form.Subscribe>
        <form.AppForm>
          <form.SubmitButton
            pendingLabel={edit ? "Saving…" : "Adding…"}
            disabled={test.state === "testing"}
          >
            {edit ? "Save changes" : "Add source"}
          </form.SubmitButton>
        </form.AppForm>
      </DialogFooter>
    </form>
  );
}
