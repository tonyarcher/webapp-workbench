import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCustomEvents } from '../lib/useCustomEvents'
import { cancelOrderFn, listOrdersFn } from '../server/fns/orders'
import '../components/sg-orders-table'

export const Route = createFileRoute('/orders')({
  component: Orders,
})

function Orders() {
  const queryClient = useQueryClient()
  const ordersQ = useQuery({
    queryKey: ['orders'],
    queryFn: () => listOrdersFn(),
    refetchInterval: 30_000,
  })
  const cancel = useMutation({
    mutationFn: (id: number) => cancelOrderFn({ data: { id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })

  const ref = useCustomEvents({
    'sg-order-cancel': (detail) => {
      cancel.mutate((detail as { id: number }).id)
    },
  })

  return (
    <>
      <h1>Scheduled orders</h1>
      <div className="card">
        <sg-orders-table ref={ref} orders={ordersQ.data ?? []} busy={cancel.isPending} />
        <OrdersHint />
      </div>
    </>
  )
}

function OrdersHint() {
  return (
    <p className="muted">
      Due orders fill during NYSE hours (9:30–16:00 ET) at the then-current quote. GTC stays
      pending overnight if the session is closed. Place them from the Trade page.
    </p>
  )
}
