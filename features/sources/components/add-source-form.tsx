"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createSource, testSourceConnection } from "@/features/sources/actions";
import { getProvider, PROVIDERS } from "@/features/sources/providers";
import { FormAlert } from "@/forms/components/form-alert";
import { useAppForm } from "@/forms/form";
import { httpsUrl, required, validate } from "@/forms/validators";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Loader2Icon } from "lucide-react";

type TestStatus =
  | { state: "idle" }
  | { state: "testing" }
  | { state: "ok" }
  | { state: "failed"; message: string };

export function AddSourceForm({ onSuccess }: { onSuccess: () => void }) {
  const [serverError, setServerError] = useState<string>();
  const [test, setTest] = useState<TestStatus>({ state: "idle" });

  const form = useAppForm({
    defaultValues: {
      name: "",
      provider: PROVIDERS[0].id,
      endpoint: "",
      bucket: "",
      accessKeyId: "",
      secretAccessKey: "",
    },
    listeners: {
      // Any edit invalidates a previous connection test result.
      onChange: () => setTest({ state: "idle" }),
    },
    onSubmit: async ({ value }) => {
      setServerError(undefined);
      const result = await createSource(value);
      if (result.error) {
        setServerError(result.error);
        return;
      }
      toast.success("Source added");
      onSuccess();
    },
  });

  const handleTest = async () => {
    setServerError(undefined);
    setTest({ state: "testing" });
    const result = await testSourceConnection(form.state.values);
    setTest(
      result.error ? { state: "failed", message: result.error } : { state: "ok" }
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

      <form.AppField name="name" validators={validate(required("Name"))}>
        {(field) => (
          <field.TextField label="Name" placeholder="Team documents" autoFocus />
        )}
      </form.AppField>

      {/* Credential fields use the selected provider's vocabulary. */}
      <form.Subscribe selector={(state) => state.values.provider}>
        {(providerId) => {
          const provider = getProvider(providerId) ?? PROVIDERS[0];
          const { bucket, accessKeyId, secretAccessKey } = provider.fieldLabels;
          return (
            <>
              <form.AppField
                name="endpoint"
                validators={validate(required("Endpoint"), httpsUrl())}
              >
                {(field) => (
                  <field.TextField
                    label="Endpoint"
                    placeholder={provider.endpointPlaceholder}
                    mono
                  />
                )}
              </form.AppField>

              <form.AppField name="bucket" validators={validate(required(bucket))}>
                {(field) => <field.TextField label={bucket} mono />}
              </form.AppField>

              <form.AppField
                name="accessKeyId"
                validators={validate(required(accessKeyId))}
              >
                {(field) => <field.TextField label={accessKeyId} mono />}
              </form.AppField>

              <form.AppField
                name="secretAccessKey"
                validators={validate(required(secretAccessKey))}
              >
                {(field) => (
                  <field.TextField label={secretAccessKey} type="password" mono />
                )}
              </form.AppField>
            </>
          );
        }}
      </form.Subscribe>

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
            pendingLabel="Adding…"
            disabled={test.state === "testing"}
          >
            Add source
          </form.SubmitButton>
        </form.AppForm>
      </DialogFooter>
    </form>
  );
}
