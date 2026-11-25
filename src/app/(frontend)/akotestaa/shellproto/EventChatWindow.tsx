'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { FloatingDockWindow } from './FloatingDockWindow'
import type {
  ActiveEventChatChannel,
  EventChatChannel,
  EventChatMessage,
} from './hooks/useEventChatAndParticipations'
import type { FloatingPos } from './protoData'

interface EventChatWindowProps {
  channels: EventChatChannel[]
  activeChannel: ActiveEventChatChannel | null
  messages: EventChatMessage[]
  currentUserEmail: string
  isDemoIdentity: boolean
  pos: FloatingPos | null
  onPosChange: (next: FloatingPos) => void
  isLoadingMessages: boolean
  isSendingMessage: boolean
  error: string | null
  onSelectChannel: (channel: ActiveEventChatChannel | null) => void
  onSendMessage: (body: string) => Promise<boolean>
}

export function EventChatWindow({
  channels,
  activeChannel,
  messages,
  currentUserEmail,
  isDemoIdentity,
  pos,
  onPosChange,
  isLoadingMessages,
  isSendingMessage,
  error,
  onSelectChannel,
  onSendMessage,
}: EventChatWindowProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (activeChannel) setIsOpen(true)
  }, [activeChannel])

  const submitMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const body = draft.trim()
    if (!body || isSendingMessage) return
    if (await onSendMessage(body)) setDraft('')
  }

  if (!isOpen) {
    if (channels.length === 0) return null
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 z-40 rounded-full border border-amber-300 bg-amber-500 px-4 py-2 text-xs font-bold text-amber-950 shadow-lg hover:bg-amber-400"
      >
        💬 Tapahtumachatit ({channels.length})
      </button>
    )
  }

  return (
    <FloatingDockWindow
      title="TAPAHTUMACHAT"
      badge={`${isDemoIdentity ? 'DEMO • ' : ''}${channels.length ? `${channels.length} KANAVAA` : 'UUSI KANAVA'}`}
      pos={pos}
      onPosChange={onPosChange}
      onClose={() => {
        setIsOpen(false)
        onSelectChannel(null)
      }}
      headerToneClass="bg-amber-950 text-amber-200"
      borderToneClass="border-amber-500/50"
    >
      <div className="flex max-h-[65vh] min-h-52 w-full flex-col gap-2 text-xs">
        <div className="max-h-28 shrink-0 space-y-1 overflow-y-auto">
          {channels.length === 0 ? (
            <p className="rounded-lg bg-zinc-900 p-2 text-zinc-300">
              Kanava luodaan ensimmäisen viestin yhteydessä.
            </p>
          ) : (
            channels.map((channel) => (
              <button
                key={channel.id}
                type="button"
                onClick={() =>
                  onSelectChannel({ id: channel.id, title: channel.title })
                }
                aria-pressed={activeChannel?.id === channel.id}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left ${
                  activeChannel?.id === channel.id
                    ? 'bg-amber-500 text-amber-950'
                    : 'bg-zinc-900 text-zinc-100 hover:bg-zinc-800'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{channel.title}</span>
                  <span className="block truncate opacity-75">
                    {channel.lastSenderName}: {channel.lastMessage}
                  </span>
                </span>
                <span className="shrink-0 text-[9px] font-bold">
                  {!channel.isEventActive ? 'PÄÄTTYNYT' : `${channel.messageCount} viestiä`}
                </span>
              </button>
            ))
          )}
        </div>

        {activeChannel ? (
          <>
            <div className="flex items-center justify-between gap-2 border-y border-white/10 py-1.5">
              <p className="min-w-0 truncate font-bold text-amber-100">{activeChannel.title}</p>
              {channels.find((channel) => channel.id === activeChannel.id)?.isEventActive ===
                false && (
                <span className="shrink-0 rounded bg-zinc-700 px-1.5 py-0.5 text-[9px] font-bold text-zinc-200">
                  TAPAHTUMA PÄÄTTYNYT
                </span>
              )}
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-rose-700 bg-rose-950/60 p-2 text-rose-200">
                {error}
              </p>
            )}
            {!currentUserEmail.trim() && (
              <p role="status" className="rounded-lg bg-zinc-900 p-2 text-amber-200">
                Kirjaudu Google-tilillä lähettääksesi viestin.
              </p>
            )}

            <div
              aria-live="polite"
              className="min-h-16 flex-1 space-y-2 overflow-y-auto rounded-lg bg-zinc-900 p-2"
            >
              {isLoadingMessages && messages.length === 0 ? (
                <p className="text-zinc-400">Ladataan viestejä...</p>
              ) : messages.length === 0 ? (
                <p className="text-zinc-400">Ei vielä viestejä. Aloita keskustelu.</p>
              ) : (
                messages.map((message) => (
                  <article key={message.id} className="rounded-md bg-zinc-800 px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2 text-[9px] text-zinc-400">
                      <span className="truncate font-semibold text-amber-200">
                        {message.senderEmail.toLowerCase() === currentUserEmail.trim().toLowerCase()
                          ? 'Sinä'
                          : message.senderName}
                      </span>
                      <time dateTime={message.createdAt}>
                        {new Date(message.createdAt).toLocaleTimeString('fi-FI', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-zinc-100">{message.body}</p>
                  </article>
                ))
              )}
            </div>

            <form onSubmit={(event) => void submitMessage(event)} className="flex gap-1.5">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={2000}
                aria-label="Kirjoita tapahtumachat-viesti"
                placeholder={currentUserEmail ? 'Kirjoita viesti...' : 'Kirjaudu viestittääksesi'}
                className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-[11px] text-white placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!draft.trim() || !currentUserEmail.trim() || isSendingMessage}
                className="rounded-lg bg-amber-500 px-2.5 py-2 text-[11px] font-bold text-amber-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSendingMessage ? '...' : 'Lähetä'}
              </button>
            </form>
          </>
        ) : (
          <p className="rounded-lg bg-zinc-900 p-2 text-zinc-400">
            Valitse kanava viestihistorian lukemiseen tai avaa uusi tapahtumachat tapahtumakortista.
          </p>
        )}
      </div>
    </FloatingDockWindow>
  )
}
