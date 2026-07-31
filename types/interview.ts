export interface InterviewQuestion {
  id: number
  question: string
  category: 'basics' | 'audience' | 'brand' | 'goals' | 'content'
}

export interface InterviewMessage {
  role: 'assistant' | 'user'
  content: string
  timestamp: string
}

export interface Interview {
  id: string
  userId: string
  title: string
  status: 'draft' | 'in-progress' | 'completed'
  progress: number
  currentQuestion: number
  messages: InterviewMessage[]
  answers: Record<number, string>
  createdAt: string
  updatedAt: string
}

export interface InterviewSession {
  interviewId: string
  currentQuestion: number
  totalQuestions: number
  messages: InterviewMessage[]
  isCompleted: boolean
}

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  { id: 1, question: "What's the name of your business or brand?", category: 'basics' },
  { id: 2, question: "In one sentence, what does your business do?", category: 'basics' },
  { id: 3, question: "Who is your ideal customer? Describe them in detail.", category: 'audience' },
  { id: 4, question: "What problem does your business solve for your customers?", category: 'audience' },
  { id: 5, question: "What makes your business different from competitors?", category: 'basics' },
  { id: 6, question: "What are your top 3 products or services?", category: 'basics' },
  { id: 7, question: "Describe the tone and personality of your brand.", category: 'brand' },
  { id: 8, question: "What are your brand colors and visual style preferences?", category: 'brand' },
  { id: 9, question: "What's your business origin story? Why did you start this?", category: 'brand' },
  { id: 10, question: "What are your core values or mission statement?", category: 'brand' },
  { id: 11, question: "What results or transformations do your customers experience?", category: 'content' },
  { id: 12, question: "Do you have any testimonials or success stories to share?", category: 'content' },
  { id: 13, question: "What are your current business goals for the next 6-12 months?", category: 'goals' },
  { id: 14, question: "What platforms are you most active on?", category: 'goals' },
  { id: 15, question: "Is there anything else you'd like your audience to know about you?", category: 'content' },
]
