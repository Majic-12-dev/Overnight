import { useEffect, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { useNavigate } from 'react-router-dom'

type DashboardToolProps = {
  tool: ToolDefinition
}

export default function DashboardTool({ tool }: DashboardToolProps) {
  const navigate = useNavigate()
  const [tools, setTools] = useState<ToolDefinition[]>([])

  useEffect(() => {
    // Dynamic import to break circular dependency
    import('@/data/toolRegistry').then((module) => {
      setTools(module.tools.filter((t) => t.id !== 'productivity-dashboard'))
    })
  }, [])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      onProcess={async () => {}}
      options={
        <div className='space-y-4'>
          <h2 className='text-xs font-semibold uppercase text-muted'>Quick Actions</h2>
          <div className='grid grid-cols-2 gap-2'>
            {tools.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => navigate(`/tool/${t.id}`)}
                  className='flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-base/60 p-4 text-center transition hover:border-accent hover:bg-accent/5'
                >
                  <Icon className='h-6 w-6 text-accent' />
                  <span className='text-xs font-medium text-text'>{t.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      }
    />
  )
}
