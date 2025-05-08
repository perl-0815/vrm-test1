import withPWA from 'next-pwa'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  swcMinify: true,
}

export default withPWA({
  ...nextConfig,
  pwa: {
    dest: 'public',
    disable: process.env.NODE_ENV === 'development', // 開発中は無効
  },
})