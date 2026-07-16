"use client";

import { Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  createSource,
  testSourceConnection,
  updateSource,
} from "@/features/sources/actions";
import { providerHint } from "@/features/sources/components/provider-catalog";
import { ProviderPlate } from "@/features/sources/components/provider-logos";
import {
  type SourceFormValues,
  sourceInputSchema,
  sourceUpdateSchema,
} from "@/features/sources/lib/schema";
import { FormAlert } from "@/forms/components/form-alert";
import { useAppForm } from "@/forms/form";
import { getProvider, PROVIDERS } from "@/lib/storage/providers";

type TestStatus =
  | { state: "idle" }
  | { state: "testing" }
  | { state: "ok" }
  | { state: "failed"; message: string };

interface SourceFormProps {
  /** Chosen in the provider picker — the form has no provider select. */
  provider: string;
  /** Sends the user back to the provider picker; typed values survive. */
  onChangeProvider: () => void;
  onSuccess: () => void;
  /** When set, the form edits an existing source instead of creating one. */
  edit?: { sourceId: string; initialValues: SourceFormValues };
}

export function SourceForm({
  provider,
  onChangeProvider,
  onSuccess,
  edit,
}: SourceFormProps) {
  const [serverError, setServerError] = useState<string>();
  const [test, setTest] = useState<TestStatus>({ state: "idle" });

  const form = useAppForm({
    defaultValues: edit?.initialValues ?? {
      name: "",
      provider,
      endpoint: "",
      bucket: "",
      accessKeyId: "",
      secretAccessKey: "",
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

  // The picker owns the provider; mirror it into the (hidden) form value so
  // validation and submission see the current choice.
  useEffect(() => {
    if (form.state.values.provider !== provider) {
      form.setFieldValue("provider", provider);
    }
  }, [provider, form]);

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

  const definition = getProvider(provider) ?? PROVIDERS[0];
  const { bucket, accessKeyId, secretAccessKey } = definition.fieldLabels;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
      className="space-y-4"
    >
      <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
        <ProviderPlate providerId={definition.id} className="size-10" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{definition.label}</div>
          <p className="truncate text-xs text-muted-foreground">
            {providerHint(definition.id)}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onChangeProvider}
        >
          Change
        </Button>
      </div>

      <form.AppField name="name">
        {(field) => (
          <field.TextField
            label="Name"
            placeholder="Team documents"
            autoFocus={!edit}
          />
        )}
      </form.AppField>

      <form.AppField name="endpoint">
        {(field) => (
          <field.TextField
            label="Endpoint"
            placeholder={definition.endpointPlaceholder}
            mono
          />
        )}
      </form.AppField>

      {/* Credential fields use the selected provider's vocabulary. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <form.AppField name="bucket">
          {(field) => <field.TextField label={bucket} mono />}
        </form.AppField>

        <form.AppField name="accessKeyId">
          {(field) => <field.TextField label={accessKeyId} mono />}
        </form.AppField>
      </div>

      <form.AppField name="secretAccessKey">
        {(field) => (
          <field.TextField
            label={secretAccessKey}
            type="password"
            autoComplete="new-password"
            placeholder={
              edit ? "Leave blank to keep the current one" : undefined
            }
            mono
          />
        )}
      </form.AppField>

      <p className="text-xs text-muted-foreground">
        Who can browse, edit or delete on this source is managed per user and
        group from the admin area.
      </p>

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
              className="sm:mr-auto"
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
