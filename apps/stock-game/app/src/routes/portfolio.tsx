import { createFileRoute } from '@tanstack/react-router'
import '../components/sg-portfolio-view'

export const Route = createFileRoute('/portfolio')({
  component: Portfolio,
})

function Portfolio() {
  return <sg-portfolio-view />
}
