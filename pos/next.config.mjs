/** @type {import('next').NextConfig} */

function getApiRemotePattern() {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return {
      protocol: url.protocol.replace(":", ""),
      hostname: url.hostname,
      ...(url.port ? { port: url.port } : {}),
      pathname: "/uploads/**",
    };
  } catch {
    return null;
  }
}

const apiPattern = getApiRemotePattern();

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "api.jlracingshop.karalliyaddaone.tech",
        pathname: "/uploads/**",
      },
      ...(apiPattern ? [apiPattern] : []),
    ],
  },
};

export default nextConfig;
