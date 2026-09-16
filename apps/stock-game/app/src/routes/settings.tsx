import { createFileRoute } from '@tanstack/react-router'
import '../components/sg-settings-view'

export const Route = createFileRoute('/settings')({
  component: Settings,
})

function Settings() {
  return <sg-settings-view />
}
