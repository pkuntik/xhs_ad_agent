import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { TaskPollingProvider } from '@/components/providers/task-polling-provider'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <TaskPollingProvider>
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
            {children}
          </main>
        </div>
      </div>
    </TaskPollingProvider>
  )
}
