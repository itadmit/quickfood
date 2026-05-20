import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // Apple Pay requires the verification file to be served at the
  // exact path /.well-known/apple-developer-merchantid-domain-association.
  // We expose the dynamic handler at a non-dotted path and rewrite to it,
  // since folders starting with "." inside app/ don't register as routes.
  async rewrites() {
    return [
      {
        source: "/.well-known/apple-developer-merchantid-domain-association",
        destination: "/api/well-known/apple-pay-domain-association",
      },
    ];
  },
};

export default nextConfig;
