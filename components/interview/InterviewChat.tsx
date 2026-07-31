'use client'

import { Sparkles, User } from 'lucide-react'

interface Message {
  role: 'assistant' | 'user'
  content: string
}

interface InterviewChatProps {
  messages: Message[]
  loading: boolean
}

export default function InterviewChat({ messages, loading }: InterviewChatProps) {
  return (
    <div className="space-y-4">
      {messages.map((message, index) => (
        <div
          key={index}
          className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          {message.role === 'assistant' && (
            <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-black" />
            </div>
          )}
          
          <div className={`max-w-[70%] rounded-2xl px-5 py-3 ${
            message.role === 'user'
              ? 'bg-brand-gold/10 border border-brand-gold/20 text-white'
              : 'glass text-white/80'
          }`}>
            <p className="whitespace-pre-wrap leading-relaxed text-sm">{message.content}</p>
          </div>

          {message.role === 'user' && (
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-white/60" />
            </div>
          )}
        </div>
      ))}

      {loading && (
        <div className="flex gap-3 justify-start">
          <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-black" />
          </div>
          <div className="glass rounded-2xl px-5 py-3">
            <div className="flex gap-1.5">
              <div className="w-2 h-2 bg-brand-gold rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-brand-gold rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-brand-gold rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
