import React from 'react'
import Layout from '../src/components/layout-client'

export default function NotFound() {
  return (
    <Layout concerts={[]}>
      <main>
        <div className="container">
          <h1>404: Not Found</h1>
          <p>The page you are looking for does not exist.</p>
        </div>
      </main>
    </Layout>
  )
}
