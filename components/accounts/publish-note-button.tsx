'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PenSquare } from 'lucide-react'
import { PublishNoteDialog } from './publish-note-dialog'

interface PublishNoteButtonProps {
  accountId: string
}

export function PublishNoteButton({ accountId }: PublishNoteButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PenSquare className="mr-2 h-4 w-4" />
        发布笔记
      </Button>
      <PublishNoteDialog
        open={open}
        onOpenChange={setOpen}
        accountId={accountId}
      />
    </>
  )
}
