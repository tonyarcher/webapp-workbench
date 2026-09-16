import { createFileRoute } from '@tanstack/react-router'
import '../components/sg-orders-view'

export const Route = createFileRoute('/orders')({
  component: Orders,
})

function Orders() {
  return <sg-orders-view />
}
