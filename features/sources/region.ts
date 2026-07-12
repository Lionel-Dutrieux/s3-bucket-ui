// AWS, Wasabi, Backblaze and DigitalOcean encode the signing region in the
// endpoint hostname: s3.<region>.amazonaws.com, s3.<region>.wasabisys.com,
// s3.<region>.backblazeb2.com, <region>.digitaloceanspaces.com.
export function regionFromEndpoint(endpoint: string): string {
  const labels = new URL(endpoint).hostname.split(".");
  if (labels[0] === "s3") {
    // s3.eu-west-3.amazonaws.com → eu-west-3 ; s3.amazonaws.com → us-east-1
    return labels.length > 3 ? labels[1] : "us-east-1";
  }
  return labels[0]; // nyc3.digitaloceanspaces.com → nyc3
}
