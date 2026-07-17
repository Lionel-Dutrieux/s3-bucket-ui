// AWS and DigitalOcean encode the signing region in the endpoint hostname:
// s3.<region>.amazonaws.com, <region>.digitaloceanspaces.com. A few providers
// encode it differently and get an explicit pattern below.
export function regionFromEndpoint(endpoint: string): string {
  const labels = new URL(endpoint).hostname.split(".");

  // Oracle: <namespace>.compat.objectstorage.<region>.oraclecloud.com
  const oci = labels.indexOf("objectstorage");
  if (oci !== -1 && labels[oci + 1]) return labels[oci + 1];

  // Tencent COS: cos.<region>.myqcloud.com
  if (labels[0] === "cos" && labels.length > 3) return labels[1];

  // Alibaba OSS: oss-<region>.aliyuncs.com
  if (labels[0].startsWith("oss-")) return labels[0].slice("oss-".length);

  // Exoscale SOS: sos-<zone>.exo.io
  if (labels[0].startsWith("sos-")) return labels[0].slice("sos-".length);

  if (labels[0] === "s3") {
    // s3.eu-west-3.amazonaws.com → eu-west-3 ; s3.amazonaws.com → us-east-1
    return labels.length > 3 ? labels[1] : "us-east-1";
  }
  return labels[0]; // nyc3.digitaloceanspaces.com → nyc3
}
