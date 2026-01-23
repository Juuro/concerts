import '../src/styles/layout.scss'

export const metadata = {
  title: 'Concerts',
  description: "List of all concerts and festivals I've visited. Including pages for every band I ever saw.",
  author: '@juuro',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
