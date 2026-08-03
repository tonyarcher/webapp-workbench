import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UpdateConfigRequest } from '@stock-game/shared'
import { useCustomEvents } from '../lib/useCustomEvents'
import { getConfigFn, updateConfigFn } from '../server/fns/config'
import '../components/sg-settings-form'

export const Route = createFileRoute('/settings')({
  component: Settings,
})

function Settings() {
  const queryClient = useQueryClient()
  const configQ = useQuery({ queryKey: ['config'], queryFn: () => getConfigFn() })
  const update = useMutation({
    mutationFn: (data: UpdateConfigRequest) => updateConfigFn({ data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config'] })
      void queryClient.invalidateQueries({ queryKey: ['portfolio'] })
      void queryClient.invalidateQueries({ queryKey: ['holdings'] })
    },
  })

  const ref = useCustomEvents({
    'sg-config-submit': (detail) => {
      update.mutate(detail as UpdateConfigRequest)
    },
  })

  return (
    <>
      <h1>Settings</h1>
      <div className="card">
        <sg-settings-form ref={ref} config={configQ.data ?? null} busy={update.isPending} />
        {update.isError ? <div className="error">{String(update.error)}</div> : ''}
        {update.isSuccess ? <div className="positive">Configuration saved.</div> : ''}
      </div>
    </>
  )
}
