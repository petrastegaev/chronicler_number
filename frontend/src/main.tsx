import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import App from './App'
import JoinPage from './pages/JoinPage'
import AdminPage from './pages/AdminPage'
import './index.css'

const router = createBrowserRouter([
  {
    path: '/',
    Component: App,
    children: [
      { index: true, Component: JoinPage },
      { path: 'admin', Component: AdminPage },
    ],
  },
])

const root = document.getElementById('root')
if (root) {
  root.innerHTML = ''
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  )
}
