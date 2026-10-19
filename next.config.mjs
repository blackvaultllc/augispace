/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // pg loads pg-cloudflare dynamically on Workers; the file tracer can't see it,
  // so force its compiled files into the server bundle.
  outputFileTracingIncludes: {
    '/*': [
      './node_modules/pg-cloudflare/dist/**/*',
      './node_modules/.pnpm/pg-cloudflare@*/node_modules/pg-cloudflare/dist/**/*',
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
          // geolocation is allowed for this origin only: the radar's "Enact perimeter scan" needs navigator.geolocation.
          // Camera and microphone stay disabled; the evidence lab uses a file input, not getUserMedia.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' },
        ],
      },
    ]
  },
}

export default nextConfig