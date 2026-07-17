import {
  siAkamai,
  siAlibabacloud,
  siBackblaze,
  siCloudflare,
  siDigitalocean,
  siExoscale,
  siGooglecloudstorage,
  siHetzner,
  siMinio,
  siNextcloud,
  siOvh,
  siScaleway,
  siVultr,
  siWasabi,
  siYandexcloud,
} from "simple-icons";
import { providerIcon } from "@/features/sources/components/provider-icons";
import { cn } from "@/lib/utils";

// Brand marks for the provider picker and admin cards. simple-icons supplies
// most of them; Amazon and Microsoft marks were removed from that set, so S3
// and Azure get hand-drawn stand-ins in the brand colors. Providers without a
// mark (generic S3, protocols, Storj) fall back to the monochrome lucide
// glyph from provider-icons.ts on a neutral plate.
interface BrandMark {
  path: string;
  hex: string;
  /** Needed by marks that punch a hole with an inner subpath. */
  evenOdd?: boolean;
}

const S3_BUCKET_MARK: BrandMark = {
  // A bucket with an open rim — the shape everyone associates with S3.
  path: "M12 2c4.42 0 8 1.12 8 2.5 0 .1-.02.2-.06.3l-2.42 14.9C17.3 21.13 14.9 22 12 22s-5.3-.87-5.52-2.3L4.06 4.8A.9.9 0 0 1 4 4.5C4 3.12 7.58 2 12 2Zm0 1.4c-3.53 0-6.4.76-6.4 1.14 0 .38 2.87 1.14 6.4 1.14s6.4-.76 6.4-1.14c0-.38-2.87-1.14-6.4-1.14Z",
  hex: "569A31",
  evenOdd: true,
};

const AZURE_MARK: BrandMark = {
  // The angular Azure "A": a left slope and a main triangle with the swoosh.
  path: "M13.55 2.2 7.4 7.65 2 17.1h4.95L13.55 2.2ZM15 4.7l-3.45 7.4 5.5 6.6-10.3 2.1H22L15 4.7Z",
  hex: "0078D4",
};

const BRAND_MARKS: Record<string, BrandMark> = {
  r2: siCloudflare,
  "aws-s3": S3_BUCKET_MARK,
  // The GCS mark ships in Google's pale blue — unreadable on white, so it
  // takes the primary Google blue instead.
  gcs: { path: siGooglecloudstorage.path, hex: "4285F4" },
  "azure-blob": AZURE_MARK,
  minio: siMinio,
  "digitalocean-spaces": siDigitalocean,
  "backblaze-b2": siBackblaze,
  hetzner: siHetzner,
  wasabi: siWasabi,
  scaleway: siScaleway,
  ovhcloud: siOvh,
  akamai: siAkamai,
  vultr: siVultr,
  exoscale: siExoscale,
  "alibaba-oss": siAlibabacloud,
  yandex: siYandexcloud,
  webdav: siNextcloud,
};

export function ProviderLogo({
  providerId,
  className,
}: {
  providerId: string;
  className?: string;
}) {
  const mark = BRAND_MARKS[providerId];
  if (!mark) {
    const Icon = providerIcon(providerId);
    return <Icon className={className} aria-hidden />;
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill={`#${mark.hex}`}
      className={className}
      role="presentation"
      aria-hidden="true"
    >
      <path d={mark.path} fillRule={mark.evenOdd ? "evenodd" : undefined} />
    </svg>
  );
}

/**
 * A provider's logo on an app-icon style plate: white for brand marks (their
 * colors are designed for light backgrounds, in dark mode too), neutral for
 * the generic and protocol entries.
 */
export function ProviderPlate({
  providerId,
  className,
}: {
  providerId: string;
  className?: string;
}) {
  const branded = providerId in BRAND_MARKS;
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg border",
        branded ? "bg-white" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      <ProviderLogo providerId={providerId} className="size-[55%]" />
    </div>
  );
}
