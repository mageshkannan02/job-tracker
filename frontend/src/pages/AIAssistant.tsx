import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  Send,
  Trash2,
  User,
  Sparkles,
  HelpCircle,
  MessageSquare,
  FileSpreadsheet,
  ExternalLink,
  CheckCircle2,
  Calendar,
  Building2,
  Briefcase,
  DollarSign,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { ChatMessage, ExcelActionSummary } from '@/types';
import { assistantApi } from '@/lib/api';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface PromptCategory {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  prompts: string[];
}

const SUGGESTED_PROMPT_CATEGORIES: PromptCategory[] = [
  {
    title: 'Excel Sheet Operations',
    icon: FileSpreadsheet,
    prompts: [
      'Add to excel: Senior Frontend Engineer at Linear, $170k, Applied today, Remote',
      'Add to excel: Product Designer at Airbnb, $160k, Hybrid, Wishlist',
      'Update Stripe status to Interview in Excel',
      'Add note for Stripe: Completed technical screening with engineering team',
      'Add follow-up for Stripe next Monday: send portfolio and code sample',
      'What applications are currently in my Excel sheet?',
    ],
  },
  {
    title: 'Interview Preparation',
    icon: HelpCircle,
    prompts: [
      'What are the most common System Design questions for Senior Backend roles?',
      'How should I structure my answer to "Tell me about a challenging bug you fixed"?',
      'Give me mock behavioral questions for a Staff Engineer role.',
    ],
  },
  {
    title: 'Outreach & Follow-Up',
    icon: MessageSquare,
    prompts: [
      'Draft a polite follow-up email after a technical round interview 4 days ago.',
      'Write a LinkedIn message to a recruiter at a target company.',
    ],
  },
];

export const AIAssistant: React.FC = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('ai_chat_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fallback
      }
    }
    return [
      {
        id: '1',
        role: 'assistant',
        content:
          "Hello! I'm your AI Career and Excel Spreadsheet Assistant. I can directly read, write, update, and manage rows in your Excel file (`applications.xlsx`), as well as help prepare for interviews and draft recruiter communications.\n\nTry telling me: \"Add to excel: Frontend Engineer at Linear, $170k, Applied today\" or \"Update Stripe to Interview\"!",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });

  const [input, setInput] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [showPrompts, setShowPrompts] = useState<boolean>(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
    localStorage.setItem('ai_chat_history', JSON.stringify(messages));
  }, [messages, isTyping]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || isTyping) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      // Build history excluding initial greeting
      const history = messages.filter((m) => m.id !== '1');
      const response = await assistantApi.chat(text.trim(), history);

      const replyContent =
        response.data?.reply ||
        response.data?.response ||
        "I've processed your request. Let me know if there's anything else you'd like to update in your Excel sheet!";

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: replyContent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        excel_action: response.data?.excel_action,
        excel_modified: response.data?.excel_modified,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (response.data?.excel_modified) {
        toast.success('Excel spreadsheet updated successfully!');
      }
    } catch (err: any) {
      toast.error(err.message || 'AI assistant request failed. Check settings.');
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${err.message || 'Unable to complete assistant request. Please verify your configuration in Settings.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    const initialGreeting: ChatMessage = {
      id: '1',
      role: 'assistant',
      content:
        "Conversation reset. How can I help you today with your applications, Excel sheet updates, or career strategy?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([initialGreeting]);
    localStorage.removeItem('ai_chat_history');
    toast.success('Conversation cleared');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] sm:h-[calc(100vh-8.5rem)] max-w-5xl mx-auto w-full">
      {/* Chat Area Card */}
      <Card className="flex-1 flex flex-col h-full min-h-[350px] overflow-hidden shadow-xs border bg-background">
        {/* Top Chat Header Bar */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3.5 border-b bg-card">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              <FileSpreadsheet className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-xs sm:text-sm truncate flex items-center gap-2">
                <span>AI Excel & Career Assistant</span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Excel Read & Write Active
                </span>
              </h3>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                <span>Connected to</span>
                <span className="font-mono text-foreground font-medium">applications.xlsx</span>
                <span>• Natural Language Sheet Writer</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPrompts((prev) => !prev)}
              className="text-xs text-muted-foreground hover:text-foreground gap-1 h-8 px-2 sm:px-2.5"
              title="Toggle suggested prompt ideas"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="hidden md:inline">{showPrompts ? 'Hide Prompts' : 'Prompt Ideas'}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearChat}
              className="text-xs text-muted-foreground hover:text-foreground gap-1.5 h-8 px-2 sm:px-3"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear Chat</span>
            </Button>
          </div>
        </div>

        {/* Suggested Quick Prompts Shelf */}
        {showPrompts && (
          <div className="border-b bg-muted/20 px-3 sm:px-6 py-2.5 overflow-x-auto scrollbar-none animate-fade-in">
            <div className="flex items-center gap-2 min-w-max">
              <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 shrink-0">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Quick Excel Actions:</span>
              </span>
              {SUGGESTED_PROMPT_CATEGORIES[0].prompts.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(prompt)}
                  disabled={isTyping}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-card hover:bg-accent border border-border/80 text-foreground hover:border-primary/40 transition-all duration-150 active:scale-95 shadow-2xs"
                >
                  <span className="truncate max-w-[220px] sm:max-w-[280px]">{prompt}</span>
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message History Stream */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3 sm:space-y-4 bg-muted/10">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={cn('flex gap-2 sm:gap-3', isUser ? 'justify-end' : 'justify-start')}
              >
                {!isUser && (
                  <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 select-none items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                    <FileSpreadsheet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </div>
                )}

                <div
                  className={cn(
                    'max-w-[92%] sm:max-w-[85%] rounded-2xl p-3 sm:p-4 text-xs sm:text-sm shadow-xs leading-relaxed space-y-2.5',
                    isUser
                      ? 'bg-primary text-primary-foreground rounded-br-xs'
                      : 'bg-card border text-card-foreground rounded-bl-xs'
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Interactive Excel Write Confirmation Card */}
                  {msg.excel_action && (
                    <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-card-foreground space-y-2 animate-scale-in">
                      <div className="flex items-center justify-between gap-2 border-b border-emerald-500/20 pb-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>Excel Sheet Updated</span>
                        </div>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold">
                          Sheet: {msg.excel_action.sheet_name}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {msg.excel_action.company_name && (
                          <div className="flex items-center gap-1.5 text-foreground">
                            <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="font-semibold">{msg.excel_action.company_name}</span>
                          </div>
                        )}
                        {msg.excel_action.job_title && (
                          <div className="flex items-center gap-1.5 text-foreground">
                            <Briefcase className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{msg.excel_action.job_title}</span>
                          </div>
                        )}
                        {msg.excel_action.status && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">Status:</span>
                            <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-primary/10 text-primary">
                              {msg.excel_action.status}
                            </span>
                          </div>
                        )}
                        {msg.excel_action.salary && (
                          <div className="flex items-center gap-1.5 text-foreground">
                            <DollarSign className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>{msg.excel_action.salary}</span>
                          </div>
                        )}
                      </div>

                      <div className="pt-1.5 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-muted-foreground">
                          Action: {msg.excel_action.action_type.replace('_', ' ')}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate('/applications')}
                          className="h-7 text-xs font-semibold gap-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-500/20 px-2.5"
                        >
                          <span>View in Applications</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {msg.timestamp && (
                    <div
                      className={cn(
                        'text-[10px] text-right pt-0.5',
                        isUser ? 'text-primary-foreground/75' : 'text-muted-foreground'
                      )}
                    >
                      {msg.timestamp}
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-2xs">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isTyping && (
            <div className="flex gap-3 justify-start animate-fade-in">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                <FileSpreadsheet className="h-4 w-4 animate-pulse" />
              </div>
              <div className="rounded-2xl rounded-bl-xs border bg-card p-3.5 shadow-xs">
                <div className="flex items-center space-x-1.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce"></div>
                  <div
                    className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce"
                    style={{ animationDelay: '0.2s' }}
                  ></div>
                  <div
                    className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce"
                    style={{ animationDelay: '0.4s' }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 border-t bg-card">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-end gap-2"
          >
            <Textarea
              rows={2}
              placeholder="Ask anything or write to Excel (e.g. 'Add to excel: Senior React Dev at Stripe, $170k, Applied', 'Update Netflix to Offer')..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="resize-none min-h-[48px] max-h-32 text-xs rounded-xl"
              disabled={isTyping}
            />

            <Button
              type="submit"
              size="icon"
              className="h-10 w-10 shrink-0 shadow-sm rounded-xl"
              disabled={!input.trim() || isTyping}
              title="Send message or Excel command"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-muted-foreground mt-2 px-1">
            <span className="flex items-center gap-1">
              <FileSpreadsheet className="w-3 h-3 text-emerald-500 shrink-0" />
              <span>Supports natural language writing into <strong>Applications</strong>, <strong>FollowUps</strong> &amp; <strong>StatusHistory</strong></span>
            </span>
            <span>Press Enter to send</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AIAssistant;
