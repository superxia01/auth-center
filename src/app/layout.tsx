import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'KeeNChase 账号中心',
  description: '统一认证中心',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
