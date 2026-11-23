/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ['ffmpeg-static'],
  images: {
    unoptimized: true,
  },
}

export default nextConfig
