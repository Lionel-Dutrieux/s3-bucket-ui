import { describe, expect, it } from "vitest";
import { regionFromEndpoint } from "./region";

describe("regionFromEndpoint", () => {
  it("keeps existing AWS / DigitalOcean behavior", () => {
    expect(regionFromEndpoint("https://s3.eu-west-3.amazonaws.com")).toBe(
      "eu-west-3",
    );
    expect(regionFromEndpoint("https://s3.amazonaws.com")).toBe("us-east-1");
    expect(regionFromEndpoint("https://nyc3.digitaloceanspaces.com")).toBe(
      "nyc3",
    );
  });
  it("extracts Tencent COS region", () => {
    expect(regionFromEndpoint("https://cos.ap-guangzhou.myqcloud.com")).toBe(
      "ap-guangzhou",
    );
  });
  it("extracts Alibaba OSS region", () => {
    expect(regionFromEndpoint("https://oss-cn-hangzhou.aliyuncs.com")).toBe(
      "cn-hangzhou",
    );
  });
  it("extracts Exoscale zone", () => {
    expect(regionFromEndpoint("https://sos-ch-gva-2.exo.io")).toBe("ch-gva-2");
  });
  it("extracts Oracle Cloud region", () => {
    expect(
      regionFromEndpoint(
        "https://ns123.compat.objectstorage.us-ashburn-1.oraclecloud.com",
      ),
    ).toBe("us-ashburn-1");
  });
});
