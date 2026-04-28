import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  Zap, 
  FileText, 
  Mail, 
  Search, 
  Bookmark, 
  Copy, 
  Upload, 
  Download,
  CheckCircle2, 
  X,
  Send,
  MessageSquare,
  Briefcase,
  Users,
  Target,
  Settings,
  AlertTriangle,
  RotateCcw,
  Plus,
  ExternalLink,
  ChevronRight,
  Info,
  Layers,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
type TabId = 'meeting' | 'email' | 'qa' | 'library';

interface Prompt {
  id: number | string;
  department: 'HR' | 'Sales' | 'Finance' | 'Operations' | 'Other';
  name: string;
  description: string;
  promptTemplate: string;
  outputMode: 'email' | 'summary' | 'json';
  category: string;
  isCustom?: boolean;
}

interface Toast {
  id: number;
  message: string;
}

// --- Components ---

const Navbar = ({ onSettingsClick, hasKey }: { onSettingsClick: () => void, hasKey: boolean }) => (
  <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
    <div className="flex items-center gap-2">
      <div className="bg-primary p-1.5 rounded-lg">
        <Zap className="w-5 h-5 text-white fill-white" />
      </div>
      <span className="text-xl font-bold tracking-tight text-dark-accent">
        BizAssist <span className="text-primary">AI</span>
      </span>
    </div>
    <div className="flex items-center gap-4">
      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-primary/5 border border-primary/20 rounded-full">
        {hasKey ? (
          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" title="AI Ready"></div>
        ) : (
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Key Required"></div>
        )}
        <span className="text-xs font-bold text-primary tracking-wide">
          App powered by Gaurang
        </span>
      </div>
      <button 
        onClick={onSettingsClick}
        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 group"
        title="Settings"
      >
        <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform duration-300" />
      </button>
    </div>
  </nav>
);

const EmptyState = ({ icon: Icon, title, description }: { icon: any, title: string, description: string }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="card flex flex-col items-center justify-center py-16 text-center bg-slate-50/50 border-dashed border-slate-200"
  >
    <div className="bg-white p-4 rounded-2xl shadow-sm mb-4 border border-slate-100 italic">
      <Icon className="w-10 h-10 text-slate-300" strokeWidth={1.5} />
    </div>
    <h3 className="font-bold text-slate-800 mb-1">{title}</h3>
    <p className="text-sm text-slate-400 max-w-[280px] leading-relaxed">
      {description}
    </p>
  </motion.div>
);

const LoadingSpinner = () => (
  <motion.div 
    animate={{ rotate: 360 }}
    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
  >
    <RotateCcw className="w-4 h-4" />
  </motion.div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('meeting');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [apiKey, setApiKey] = useState<string | null>(() => localStorage.getItem('geminiApiKey'));
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [newApiKey, setNewApiKey] = useState(apiKey || '');
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);

  const [showWelcome, setShowWelcome] = useState(() => {
    try {
      return !localStorage.getItem('visited');
    } catch {
      return true;
    }
  });
  const [showBanner, setShowBanner] = useState(true);
  
  const dismissWelcome = () => {
    try {
      localStorage.setItem('visited', 'true');
    } catch (e) {
      console.warn("LocalStorage blocked, welcome will reappear on refresh");
    }
    setShowWelcome(false);
  };
  
  // Checklist for welcome modal
  const [checklist, setChecklist] = useState({
    key: !!apiKey,
    meeting: false,
    prompt: false
  });
  
  // Meeting Summariser State
  const [meetingNotes, setMeetingNotes] = useState('');
  const [meetingOption, setMeetingOption] = useState('Full Report');
  const [isLoading, setIsLoading] = useState(false);
  const [summaryResult, setSummaryResult] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const [emailDesc, setEmailDesc] = useState('');
  const [emailContext, setEmailContext] = useState('');
  const [emailTone, setEmailTone] = useState('Professional');
  const [emailRecipient, setEmailRecipient] = useState('');
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [emailResult, setEmailResult] = useState<{ subject: string; body: string } | null>(null);
  const [emailApiError, setEmailApiError] = useState<string | null>(null);

  const testConnection = async () => {
    if (!newApiKey.trim()) return;
    setIsTestingKey(true);
    setTestResult(null);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${newApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: "Hello, respond with just the word OK" }] }] })
      });
      const data = await response.json();
      if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text?.includes('OK')) {
        setTestResult('success');
      } else {
        setTestResult('failed');
      }
    } catch {
      setTestResult('failed');
    } finally {
      setIsTestingKey(false);
    }
  };

  const fetchEmailDraft = async (refinement?: string) => {
    if (!apiKey) {
      setIsApiKeyModalOpen(true);
      return;
    }

    setIsEmailLoading(true);
    setEmailApiError(null);

    const toneDescriptions: Record<string, string> = {
      'Professional': 'formal, structured, respectful distance',
      'Friendly': 'warm, approachable, uses first names',
      'Assertive': 'direct and clear, no ambiguity — for escalations or deadlines',
      'Concise': 'under 100 words, gets to the point immediately'
    };

    const systemPrompt = "You are an expert corporate communication specialist. You write clear, effective emails tailored to the specified tone.\nRules: Always include a subject line labelled 'Subject:'. Write the full email body below. Match the tone exactly. No placeholders — if context is missing, use professional defaults. Never exceed 250 words unless the Detailed tone is selected. Sign off appropriately for the chosen tone.";
    
    let basePrompt = `TONE: ${emailTone} — ${toneDescriptions[emailTone]}\nRECIPIENT: ${emailRecipient || 'colleague'}\nCONTEXT: ${emailContext || 'None provided'}\nTASK: ${emailDesc}\nWrite a complete professional email.`;
    
    if (refinement) {
      basePrompt += `\n\nREFINEMENT: ${refinement}`;
    }

    const fullPrompt = `${systemPrompt}\n\n${basePrompt}`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { temperature: 0.6 }
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'API request failed');
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        // Simple parsing for Subject and Body
        const subjectMatch = text.match(/Subject:\s*(.*)/i);
        const subject = subjectMatch ? subjectMatch[1].trim() : "Draft Email";
        const body = text.replace(/Subject:.*\n?/i, '').trim();
        
        setEmailResult({ subject, body });
        setTimeout(() => {
          outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } else {
        throw new Error('No response content from AI');
      }
    } catch (err) {
      setEmailApiError(err instanceof Error ? err.message : 'Could not reach AI');
    } finally {
      setIsEmailLoading(false);
    }
  };

  const copyFullEmail = () => {
    if (!emailResult) return;
    const fullText = `Subject: ${emailResult.subject}\n\n${emailResult.body}`;
    copyToClipboard(fullText);
  };
  
  // Q&A State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [qaFileBase64, setQaFileBase64] = useState<string | null>(null);
  const [qaFileText, setQaFileText] = useState<string | null>(null);
  const [qaQuestion, setQaQuestion] = useState('');
  const [isQaLoading, setIsQaLoading] = useState(false);
  const [qaHistory, setQaHistory] = useState<{ role: 'user' | 'model'; parts: { text: string }[] }[]>([]);
  const [qaError, setQaError] = useState<string | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState('');

  const handleFileChange = (file: File | null) => {
    if (!file) {
      setSelectedFile(null);
      setQaFileBase64(null);
      setQaFileText(null);
      return;
    }

    const supportedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'text/plain', 'text/csv', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!supportedTypes.includes(file.type) && !file.name.endsWith('.docx') && !file.name.endsWith('.csv')) {
      addToast("Unsupported file type. Try PDF, PNG, JPG, or TXT.");
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();

    if (file.type === 'text/plain' || file.type === 'text/csv' || file.name.endsWith('.csv')) {
      reader.onload = (e) => setQaFileText(e.target?.result as string);
      reader.readAsText(file);
    } else {
      reader.onload = (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        setQaFileBase64(base64);
      };
      reader.readAsDataURL(file);
    }
    setQaHistory([]); // Clear history for new file
    setQaError(null);
  };

  const fetchQaAnswer = async (question: string, isFollowUp: boolean = false) => {
    if (!apiKey) {
      setIsApiKeyModalOpen(true);
      return;
    }

    setIsQaLoading(true);
    setQaError(null);

    const systemPrompt = "SYSTEM: You are a precise document analyst. Answer only from the document provided. If the answer is not in the document, say so clearly. Be concise. End every answer with: Source: [quote the exact sentence or figure from the document that supports your answer].";
    
    const parts: any[] = [
      { text: systemPrompt },
    ];

    // Add conversation history for context
    qaHistory.forEach(h => {
      parts.push(...h.parts);
    });

    parts.push({ text: `QUESTION: ${question}` });

    if (qaFileBase64) {
      parts.push({ 
        inlineData: { 
          mimeType: selectedFile?.type || "application/pdf", 
          data: qaFileBase64 
        } 
      });
    } else if (qaFileText) {
      parts.push({ text: `DOCUMENT CONTENT:\n${qaFileText}` });
    }

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'API request failed');

      const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (answer) {
        const newEntry: any = { role: 'model', parts: [{ text: answer }] };
        const userEntry: any = { role: 'user', parts: [{ text: question }] };
        setQaHistory(prev => [...prev, userEntry, newEntry]);
        setQaQuestion('');
        setFollowUpQuestion('');
        setTimeout(() => {
          outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } else {
        throw new Error('No response content from AI');
      }
    } catch (err) {
      setQaError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsQaLoading(false);
    }
  };

  const isImage = selectedFile?.type.startsWith('image/');
  const suggestedQuestions = isImage 
    ? ["Describe this image", "Extract all text visible", "Summarise the data or chart", "List all people or brands visible"]
    : ["Summarise this document in 5 bullet points", "What are the key numbers or deadlines?", "List all action items", "What is the main recommendation?", "Extract all names mentioned"];

  // Library State
  const INITIAL_PROMPTS: Prompt[] = [
    { id: 1, department: "HR", name: "Job Description Writer", description: "Turns a role title and responsibilities into a complete job description.", promptTemplate: "Write a compelling job description for the following role.\nRole Title: [ROLE]\nKey Responsibilities:\n[RESPONSIBILITIES]\nInclude: Overview paragraph, day-to-day duties as bullet points, required qualifications, nice-to-have skills, and a short 'Why join us' section. Keep it engaging and inclusive.", outputMode: "email", category: "HR" },
    { id: 2, department: "HR", name: "Performance Review Summariser", description: "Converts rough manager notes into a structured performance summary.", promptTemplate: "You are an HR professional. Convert these raw manager notes into a formal performance review summary.\n\nNotes:\n[NOTES]\n\nOutput format:\n- Overall performance: [Exceeds / Meets / Below expectations]\n- Key achievements (3 bullets)\n- Development areas (2 bullets)\n- Recommended actions\n- Suggested rating: [1-5]", outputMode: "summary", category: "HR" },
    { id: 3, department: "Sales", name: "Cold Email Generator", description: "Writes a personalised cold outreach email for a specific prospect.", promptTemplate: "Write a cold sales email.\nProspect company: [COMPANY]\nProspect role: [ROLE]\nTheir likely pain point: [PAIN_POINT]\nOur product/service: [OUR_OFFER]\nTone: friendly but professional. Subject line required. Under 120 words. End with one clear call to action.", outputMode: "email", category: "Sales" },
    { id: 4, department: "Sales", name: "Objection Handler", description: "Turns a client objection into 3 empathetic, effective responses.", promptTemplate: "A client has raised this objection:\n[OBJECTION]\n\nGenerate 3 different responses for our sales team to use. Each should:\n1. Acknowledge the concern genuinely\n2. Reframe it with a specific benefit\n3. Suggest a concrete next step\nLabel each response Option A, B, C.", outputMode: "summary", category: "Sales" },
    { id: 5, department: "Finance", name: "Variance Commentary", description: "Generates professional finance commentary for budget vs actuals.", promptTemplate: "Write a professional variance commentary for a finance report.\nBudget: [BUDGET]\n\nActual: [ACTUAL]\nVariance: [VARIANCE]\nContext: [CONTEXT]\nExplain the variance, likely root causes, and whether it is a concern or within acceptable range. Use formal finance language. 3 paragraphs maximum.", outputMode: "summary", category: "Finance" },
    { id: 6, department: "Finance", name: "Invoice Anomaly Detector", description: "Checks invoice data for errors or unusual patterns.", promptTemplate: "Analyse this invoice data and flag any anomalies, errors, or unusual patterns.\nReturn a JSON object: { flagged: true/false, issues: [list of issues], severity: 'Low/Medium/High', recommendation: 'action to take' }\n\nInvoice data:\n[INVOICE_DATA]", outputMode: "json", category: "Finance" },
    { id: 7, department: "Operations", name: "SOP Drafter", description: "Converts a plain-language process description into a formal SOP.", promptTemplate: "Write a Standard Operating Procedure (SOP) document.\nProcess name: [PROCESS_NAME]\nProcess description: [DESCRIPTION]\nFormat: Title, Purpose, Scope, Roles & Responsibilities, Step-by-step instructions (numbered), Notes & warnings, Version 1.0 footer.\nTone: clear, professional, unambiguous.", outputMode: "summary", category: "Operations" },
    { id: 8, department: "Operations", name: "Meeting Agenda Builder", description: "Creates a structured meeting agenda from a topic list.", promptTemplate: "Create a professional meeting agenda.\nMeeting purpose: [PURPOSE]\nAttendees: [ATTENDEES]\nDuration: [DURATION]\nTopics to cover: [TOPICS]\nFormat each agenda item with: time allocation, presenter, desired outcome. Add a 5-minute buffer and an AOB section at the end.", outputMode: "summary", category: "Operations" },
    { id: 9, department: "HR", name: "Policy Q&A System Prompt", description: "A system prompt to make AI answer questions from your HR policy document.", promptTemplate: "You are a helpful HR assistant with access to the company policy document provided. Answer employee questions accurately and cite the specific policy section where possible. If the answer is not in the document, say 'This is not covered in our current policy — please contact HR directly.' Be empathetic and clear.\n\nPolicy document:\n[PASTE_POLICY_DOCUMENT_HERE]", outputMode: "summary", category: "HR" },
    { id: 10, department: "Sales", name: "Proposal Executive Summary", description: "Generates a concise executive summary from a full proposal document.", promptTemplate: "Read this proposal and write a 1-page executive summary for a busy C-level reader.\nHighlight: the problem being solved, our proposed solution, key benefits (3 max), investment required, and recommended next step.\nTone: confident, results-focused. No jargon.\n\nProposal content:\n[PROPOSAL_CONTENT]", outputMode: "summary", category: "Sales" }
  ];

  const [customPrompts, setCustomPrompts] = useState<Prompt[]>(() => {
    const saved = localStorage.getItem('customPrompts');
    return saved ? JSON.parse(saved) : [];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [libraryFilter, setLibraryFilter] = useState('All');
  
  // Use Prompt Modal
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [editedTemplate, setEditedTemplate] = useState('');

  // Add Prompt Modal
  const [isAddingPrompt, setIsAddingPrompt] = useState(false);
  const [newPromptForm, setNewPromptForm] = useState({
    name: '',
    department: 'HR' as Prompt['department'],
    description: '',
    promptTemplate: ''
  });

  const allPrompts = (() => {
    const combined = [...customPrompts, ...INITIAL_PROMPTS];
    const seen = new Set();
    return combined.filter(p => {
      if (!p.id) return false;
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  })();

  useEffect(() => {
    localStorage.setItem('customPrompts', JSON.stringify(customPrompts));
  }, [customPrompts]);

  useEffect(() => {
    if (selectedPrompt) {
      setEditedTemplate(selectedPrompt.promptTemplate);
      const placeholders = selectedPrompt.promptTemplate.match(/\[([^\]]+)\]/g) || [];
      const initialValues: Record<string, string> = {};
      placeholders.forEach(p => {
        const key = p.slice(1, -1);
        initialValues[key] = '';
      });
      setFormValues(initialValues);
    }
  }, [selectedPrompt]);

  const filledPrompt = editedTemplate.replace(/\[([^\]]+)\]/g, (match) => {
    const key = match.slice(1, -1);
    return formValues[key] || match;
  });

  const saveCustomPrompt = () => {
    if (!newPromptForm.name || !newPromptForm.promptTemplate) {
      addToast("Name and template are required");
      return;
    }
    const newPrompt: Prompt = {
      ...newPromptForm,
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      outputMode: 'summary',
      category: newPromptForm.department,
      isCustom: true
    };
    setCustomPrompts([newPrompt, ...customPrompts]);
    setIsAddingPrompt(false);
    setNewPromptForm({ name: '', department: 'HR', description: '', promptTemplate: '' });
    addToast("Custom prompt added!");
  };

  const exportLibrary = () => {
    const dataStr = JSON.stringify(allPrompts, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bizassist-prompts-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    addToast("Library exported!");
  };

  const importLibrary = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string) as Prompt[];
        
        setCustomPrompts(prev => {
          const merged = [...imported, ...prev];
          const seen = new Set();
          return merged.filter(p => {
            if (!p.id || INITIAL_PROMPTS.find(ip => ip.id === p.id)) return false;
            if (seen.has(p.id)) return false;
            seen.add(p.id);
            return true;
          });
        });
        
        addToast("Library imported successfully!");
      } catch (err) {
        addToast("Error importing library");
      }
    };
    reader.readAsText(file);
  };

  const addToast = (message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const handleAction = () => {
    addToast("Coming in the next phase!");
  };

  const saveApiKey = () => {
    if (newApiKey.trim()) {
      localStorage.setItem('geminiApiKey', newApiKey.trim());
      setApiKey(newApiKey.trim());
      setIsApiKeyModalOpen(false);
      setNewApiKey('');
      addToast("API Key saved successfully!");
    }
  };

  const fetchSummary = async () => {
    if (!apiKey) {
      setIsApiKeyModalOpen(true);
      return;
    }

    setIsLoading(true);
    setApiError(null);
    setSummaryResult(null);

    const systemPrompt = "You are a professional corporate meeting assistant. You help teams extract value from meeting notes quickly and accurately.\nRules: Be concise. Use clear headings. Extract owner names from context. Flag any items marked as urgent. Never add information that wasn't in the notes.";
    const fullPrompt = `${systemPrompt}\n\nMODE: ${meetingOption}\n\nMEETING NOTES:\n${meetingNotes}`;

    try {
      // Using gemini-2.5-flash for latest features and performance
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
      });

      const data = await response.json();
      
      if (!response.ok) {
        const errorMsg = data.error?.message || 'API request failed';
        if (errorMsg.toLowerCase().includes('high demand') || errorMsg.toLowerCase().includes('overloaded')) {
          throw new Error('The AI model is currently at capacity due to high demand. Please wait a minute and click Retry.');
        }
        throw new Error(errorMsg);
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        setSummaryResult(text);
        setTimeout(() => {
          outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } else {
        throw new Error('No response content from AI');
      }
    } catch (err) {
      console.error(err);
      setApiError('Could not reach AI. Check your API key or internet connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const startNewSummary = () => {
    setMeetingNotes('');
    setSummaryResult(null);
    setApiError(null);
  };

  const emailSummary = () => {
    if (!summaryResult) return;
    const date = new Date().toLocaleDateString();
    const subject = encodeURIComponent(`Meeting Summary — ${date}`);
    const body = encodeURIComponent(summaryResult);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const ActionItemRow = ({ children }: { children: React.ReactNode }) => {
    // Basic detection for "item [Owner] [Deadline]"
    const text = String(children);
    const ownerMatch = text.match(/\[([^\]]+)\]/g);
    
    // We'll just render it as a checklist line for now
    return (
      <div className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0 group">
        <input type="checkbox" className="mt-1 w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary" />
        <div className="flex-1 text-sm text-slate-700 leading-relaxed">
          {children}
        </div>
      </div>
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast("Copied to clipboard!");
  };

  const tabs = [
    { id: 'meeting', label: 'Meeting Summariser', icon: FileText },
    { id: 'email', label: 'Email Drafter', icon: Mail },
    { id: 'qa', label: 'Document Q&A', icon: Search },
    { id: 'library', label: 'Prompt Library', icon: Bookmark },
  ] as const;

  const tones = ['Professional', 'Friendly', 'Assertive', 'Concise'];
  const categories = ['All', 'HR', 'Sales', 'Finance', 'Operations'];

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-primary/20">
      <AnimatePresence>
        {showBanner && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-dark-accent text-white py-2 px-6 flex items-center justify-between overflow-hidden"
          >
            <div className="flex items-center gap-2 text-[11px] font-bold tracking-wide">
              <Sparkles className="w-3 h-3 text-primary" />
              <span>Session 1 complete. Next session: we build Python AI agents!</span>
            </div>
            <button onClick={() => setShowBanner(false)} className="hover:text-primary transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <Navbar hasKey={!!apiKey} onSettingsClick={() => setIsApiKeyModalOpen(true)} />

      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8">
        {/* Tab Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab-pill ${
                activeTab === tab.id ? 'tab-pill-active' : 'tab-pill-inactive'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Panels */}
        <div className="relative">
          <AnimatePresence mode="wait">
            {activeTab === 'meeting' && (
              <motion.div
                key="meeting"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {!apiKey && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-amber-800">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      <p className="text-sm font-medium">Add your Gemini API key in Settings to enable AI</p>
                    </div>
                    <button 
                      onClick={() => setIsApiKeyModalOpen(true)}
                      className="text-amber-900 font-bold text-sm bg-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-300 transition-colors"
                    >
                      Add Key
                    </button>
                  </div>
                )}

                <div className="card">
                  <label className="block text-sm font-semibold mb-3">Meeting Notes or Transcript</label>
                  <textarea
                    className="input-field min-h-[200px] placeholder:text-slate-300"
                    placeholder="Example: Sales team sync — 14 Jan 2026. Present: Ahmed, Priya, James. Q1 pipeline discussed. Ahmed to follow up with TechCorp by Friday. Priya presented deck — approved for client send. James flagged delay on proposal — needs legal review first..."
                    value={meetingNotes}
                    onChange={(e) => setMeetingNotes(e.target.value)}
                  />
                  
                  <div className="mt-6 space-y-4">
                    <label className="block text-sm font-semibold">Summary Options</label>
                    <div className="flex flex-wrap gap-2">
                      {['Summary Only', 'Action Items Only', 'Full Report'].map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setMeetingOption(opt)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                            meetingOption === opt 
                              ? 'bg-primary/10 border-primary text-primary' 
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button 
                    className="btn-primary w-full mt-8"
                    disabled={!meetingNotes.trim() || isLoading}
                    onClick={() => {
                      fetchSummary();
                      setChecklist(prev => ({ ...prev, meeting: true }));
                    }}
                  >
                    {isLoading ? (
                      <>
                        <LoadingSpinner />
                        Analysing notes...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Summarise with AI
                      </>
                    )}
                  </button>
                </div>

                {apiError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-red-800">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      <p className="text-sm font-medium">{apiError}</p>
                    </div>
                    <button 
                      onClick={fetchSummary}
                      className="text-red-900 font-bold text-sm bg-red-200 px-3 py-1.5 rounded-lg hover:bg-red-300 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {isLoading && (
                  <div className="card flex flex-col items-center justify-center py-16 text-slate-400">
                    <div className="flex gap-1 mb-4">
                      <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-2 h-2 bg-primary rounded-full" />
                      <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 bg-primary rounded-full" />
                      <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 bg-primary rounded-full" />
                    </div>
                    <p className="text-sm font-medium">Extracting key insights...</p>
                  </div>
                )}

                {summaryResult && (
                  <div ref={outputRef} className="card animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                      <h3 className="font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                        Meeting Intelligence
                      </h3>
                      <button 
                        onClick={() => copyToClipboard(summaryResult)}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
                        title="Copy text"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="markdown-body prose prose-slate max-w-none prose-sm">
                      <ReactMarkdown
                        components={{
                          li: ({ node, children, ...props }) => {
                            const text = String(children);
                            const isActionItem = meetingOption.includes('Action Items') || text.includes('[ ]') || text.includes('[x]');
                            
                            if (isActionItem) {
                              // Try to find owner: (Name) or [Name]
                              const ownerMatch = text.match(/\(([^)]+)\)|\[([^\]]+)\]/);
                              const owner = ownerMatch ? (ownerMatch[1] || ownerMatch[2]) : null;
                              
                              // Try to find deadline: by [Date] or due [Date]
                              const deadlineMatch = text.match(/by\s+([A-Za-z0-9\s,]+)|due\s+([A-Za-z0-9\s,]+)/i);
                              const deadline = deadlineMatch ? (deadlineMatch[1] || deadlineMatch[2]) : null;
                              
                              const cleanText = text
                                .replace(/\(([^)]+)\)|\[([^\]]+)\]/, '') // remove owner
                                .replace(/by\s+([A-Za-z0-9\s,]+)|due\s+([A-Za-z0-9\s,]+)/i, '') // remove deadline
                                .replace(/^-\s*\[\s*\]\s*/, '') // remove md checkbox
                                .replace(/^-\s*/, '') // remove bullet
                                .trim();

                              return (
                                <div className="flex items-start gap-3 py-2.5 border-b border-slate-50 last:border-0 group">
                                  <div className="mt-0.5 relative flex items-center justify-center">
                                    <input 
                                      type="checkbox" 
                                      className="peer h-4 w-4 appearance-none rounded border border-slate-300 bg-white checked:bg-primary checked:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer" 
                                    />
                                    <CheckCircle2 className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                                  </div>
                                  <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
                                    <span className="text-sm text-slate-700 font-medium">{cleanText}</span>
                                    <div className="flex items-center gap-2">
                                      {owner && (
                                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold whitespace-nowrap">
                                          {owner}
                                        </span>
                                      )}
                                      {deadline && (
                                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold whitespace-nowrap">
                                          {deadline}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return <li {...props} className="mb-2 last:mb-0 ml-4 list-disc" />;
                          },
                          h1: ({node, ...props}) => <h1 {...props} className="text-lg font-bold mt-4 mb-2" />,
                          h2: ({node, ...props}) => <h2 {...props} className="text-base font-bold mt-4 mb-2" />,
                          h3: ({node, ...props}) => <h3 {...props} className="text-sm font-bold mt-3 mb-1 uppercase text-slate-500 tracking-wider" />,
                          p: ({node, ...props}) => <p {...props} className="mb-3 last:mb-0" />,
                        }}
                      >
                        {summaryResult}
                      </ReactMarkdown>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8 pt-6 border-t border-slate-100">
                      <button 
                        onClick={() => { copyToClipboard(summaryResult); addToast("Copied!"); }}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy Summary
                      </button>
                      <button 
                        onClick={emailSummary}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        Email This Summary
                      </button>
                      <button 
                        onClick={startNewSummary}
                        className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Start New Summary
                      </button>
                    </div>
                  </div>
                )}

                {!summaryResult && !isLoading && (
                  <EmptyState 
                    icon={Layers} 
                    title="No intelligence yet" 
                    description="Paste your meeting notes above and click Summarise to see the AI magic."
                  />
                )}
              </motion.div>
            )}

            {activeTab === 'email' && (
              <motion.div
                key="email"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {!apiKey && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-amber-800">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      <p className="text-sm font-medium">Add your Gemini API key in Settings to enable AI</p>
                    </div>
                    <button 
                      onClick={() => setIsApiKeyModalOpen(true)}
                      className="text-amber-900 font-bold text-sm bg-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-300 transition-colors"
                    >
                      Add Key
                    </button>
                  </div>
                )}

                <div className="card">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold mb-3">What do you want to say?</label>
                      <textarea
                        className="input-field min-h-[150px]"
                        placeholder="Describe in plain language..."
                        value={emailDesc}
                        onChange={(e) => setEmailDesc(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-3">Recipient</label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Who is this to? Role or name (optional)"
                          value={emailRecipient}
                          onChange={(e) => setEmailRecipient(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-3">Extra Context (Optional)</label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="e.g. urgent, company name..."
                          value={emailContext}
                          onChange={(e) => setEmailContext(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-3">Tone</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { id: 'Professional', desc: 'formal, structured, respectful' },
                          { id: 'Friendly', desc: 'warm, approachable, reachable' },
                          { id: 'Assertive', desc: 'direct, clear, no ambiguity' },
                          { id: 'Concise', desc: 'short, gets to the point' },
                        ].map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setEmailTone(t.id)}
                            className={`p-4 rounded-xl border text-left transition-all ${
                              emailTone === t.id
                                ? 'bg-primary/5 border-primary ring-1 ring-primary/20 shadow-sm'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className={`text-sm font-bold ${emailTone === t.id ? 'text-primary' : 'text-slate-700'}`}>
                              {t.id}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium mt-0.5">{t.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <button 
                      className="btn-primary w-full"
                      disabled={!emailDesc.trim() || isEmailLoading}
                      onClick={() => fetchEmailDraft()}
                    >
                      {isEmailLoading ? (
                        <>
                          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                            <RotateCcw className="w-4 h-4" />
                          </motion.div>
                          Drafting Email...
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4" />
                          Draft Email with AI
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {emailApiError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-red-800">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      <p className="text-sm font-medium">{emailApiError}</p>
                    </div>
                    <button 
                      onClick={() => fetchEmailDraft()}
                      className="text-red-900 font-bold text-sm bg-red-200 px-3 py-1.5 rounded-lg hover:bg-red-300 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {isEmailLoading && !emailResult && (
                  <div className="card flex flex-col items-center justify-center py-16 text-slate-400">
                    <div className="flex gap-1 mb-4">
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-2 h-2 bg-primary rounded-full" />
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-2 h-2 bg-primary rounded-full" />
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} className="w-2 h-2 bg-primary rounded-full" />
                    </div>
                    <p className="text-sm font-medium italic">Finding the perfect words...</p>
                  </div>
                )}

                {emailResult && (
                  <div ref={outputRef} className="card space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-primary" />
                        <span className="text-sm font-bold text-dark-accent uppercase tracking-wider">AI Draft</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                        {emailTone}
                      </span>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 group relative">
                        <div className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-tight">Subject</div>
                        <div className="text-sm font-semibold text-slate-800 pr-8">{emailResult.subject}</div>
                        <button 
                          onClick={() => copyToClipboard(emailResult.subject)}
                          className="absolute right-2 top-2 p-1.5 hover:bg-slate-200 rounded-md transition-colors text-slate-400 opacity-0 group-hover:opacity-100"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed min-h-[100px]">
                        {emailResult.body}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      <span className="text-[10px] text-slate-400 font-medium">
                        {emailResult.body.split(/\s+/).filter(Boolean).length} words
                      </span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => copyFullEmail()}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-[10px] font-bold rounded-lg hover:bg-primary-dark transition-all"
                        >
                          <Copy className="w-3 h-3" />
                          Copy Full Email
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <button 
                        onClick={() => fetchEmailDraft()}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold transition-all"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Regenerate
                      </button>
                      <button 
                        onClick={() => fetchEmailDraft("Revise this to be at least 30% shorter while keeping all key information.")}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold transition-all"
                      >
                        Make Shorter
                      </button>
                      <button 
                        onClick={() => fetchEmailDraft("Rewrite at a higher formality level.")}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold transition-all"
                      >
                        More Formal
                      </button>
                    </div>
                  </div>
                )}

                {!emailResult && !isEmailLoading && (
                  <EmptyState 
                    icon={Mail} 
                    title="Awaiting your prompt" 
                    description="Tell us what you want to say, and we'll draft the perfect professional email for you."
                  />
                )}
              </motion.div>
            )}

            {activeTab === 'qa' && (
              <motion.div
                key="qa"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {!apiKey && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between mb-8 shadow-sm"
                  >
                    <div className="flex items-center gap-3 text-amber-800">
                      <div className="bg-amber-100 p-2 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                      </div>
                      <p className="text-sm font-bold">Add your Gemini API key in Settings to enable AI</p>
                    </div>
                    <button 
                      onClick={() => setIsApiKeyModalOpen(true)}
                      className="text-amber-900 font-bold text-sm bg-amber-200 px-4 py-2 rounded-xl hover:bg-amber-300 transition-all shadow-sm"
                    >
                      Connect Now
                    </button>
                  </motion.div>
                )}

                <div className="card">
                  <div className="space-y-6">
                    <div 
                      className={`border-2 border-dashed rounded-xl p-8 transition-colors flex flex-col items-center justify-center cursor-pointer ${
                        selectedFile ? 'border-primary/50 bg-primary/5' : 'border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100/50'
                      }`}
                      onClick={() => document.getElementById('file-upload')?.click()}
                    >
                      <input 
                        type="file" 
                        id="file-upload" 
                        className="hidden" 
                        accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.docx"
                        onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                      />
                      {selectedFile ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="bg-primary/10 p-3 rounded-full">
                            <CheckCircle2 className="w-6 h-6 text-primary" />
                          </div>
                          <div className="text-center">
                            <span className="font-bold text-slate-800 block text-sm">{selectedFile.name}</span>
                            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {selectedFile.type || 'Document'}
                            </span>
                          </div>
                          <button 
                            className="text-xs text-primary font-bold hover:underline mt-2"
                            onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setQaFileBase64(null); setQaHistory([]); }}
                          >
                            Change File
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3 text-slate-500">
                          <Upload className="w-10 h-10 mb-1 opacity-50" />
                          <div className="text-center">
                            <span className="font-bold text-slate-700 block">Drop a file here</span>
                            <span className="text-xs">PDF, Image, Word, or Text (Max 10MB)</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {!selectedFile && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { icon: FileText, title: "Contract Analysis", desc: "What are the payment terms?" },
                          { icon: Target, title: "Chart Analysis", desc: "What is the trend over time?" },
                          { icon: Users, title: "Meeting Slides", desc: "What decisions were made?" },
                        ].map((use, i) => (
                          <div key={i} className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                            <use.icon className="w-4 h-4 text-slate-400 mb-2" />
                            <div className="text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-tight">{use.title}</div>
                            <div className="text-[10px] text-slate-400 italic font-medium leading-tight">"{use.desc}"</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedFile && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold mb-3 text-slate-700">What would you like to know?</label>
                          <textarea
                            className="input-field min-h-[100px]"
                            placeholder="Type your question here or select a suggestion..."
                            value={qaQuestion}
                            onChange={(e) => setQaQuestion(e.target.value)}
                          />
                        </div>

                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
                          {suggestedQuestions.map((q) => (
                            <button
                              key={q}
                              onClick={() => setQaQuestion(q)}
                              className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 text-[10px] font-bold whitespace-nowrap transition-colors border border-slate-200"
                            >
                              {q}
                            </button>
                          ))}
                        </div>

                        <button 
                          className="btn-primary w-full"
                          disabled={!selectedFile || !qaQuestion.trim() || isQaLoading}
                          onClick={() => fetchQaAnswer(qaQuestion)}
                        >
                          {isQaLoading ? <LoadingSpinner /> : <Search className="w-4 h-4" />}
                          {isQaLoading ? 'Analysing Document...' : 'Ask AI'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {qaError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-red-800">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      <p className="text-sm font-medium">{qaError}</p>
                    </div>
                    <button onClick={() => fetchQaAnswer(qaQuestion)} className="text-red-900 font-bold text-sm bg-red-200 px-3 py-1.5 rounded-lg hover:bg-red-300">Retry</button>
                  </div>
                )}

                {qaHistory.length > 0 && (
                  <div ref={outputRef} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {qaHistory.map((entry, idx) => {
                      if (entry.role === 'user') return (
                        <div key={idx} className="flex justify-end pr-4">
                          <div className="bg-dark-accent text-white px-4 py-2 rounded-2xl rounded-tr-none text-sm font-medium max-w-[80%]">
                            {entry.parts[0].text}
                          </div>
                        </div>
                      );

                      const fullText = entry.parts[0].text;
                      const sourceIndex = fullText.indexOf("Source:");
                      const answerText = sourceIndex !== -1 ? fullText.substring(0, sourceIndex) : fullText;
                      const sourceText = sourceIndex !== -1 ? fullText.substring(sourceIndex) : null;

                      return (
                        <div key={idx} className="card space-y-4">
                          <div className="flex items-center gap-2 mb-4 text-primary font-bold text-xs uppercase tracking-widest border-b border-slate-50 pb-2">
                            <MessageSquare className="w-4 h-4" />
                            Analysis Result
                          </div>
                          <div className="markdown-body prose prose-slate prose-sm max-w-none">
                            <ReactMarkdown>{answerText}</ReactMarkdown>
                          </div>
                          {sourceText && (
                            <div className="bg-slate-50 border-l-4 border-primary/30 p-3 rounded-r-lg">
                              <div className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-tighter">Verified Source</div>
                              <div className="text-[11px] text-slate-500 italic leading-relaxed">
                                {sourceText.replace("Source:", "").trim()}
                              </div>
                            </div>
                          )}
                          <div className="flex justify-end pt-2">
                             <button 
                                onClick={() => { copyToClipboard(answerText); addToast("Answer copied!"); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-100 rounded-lg text-slate-500 text-[10px] font-bold transition-all"
                             >
                                <Copy className="w-3.5 h-3.5" />
                                Copy Answer
                             </button>
                          </div>
                        </div>
                      );
                    })}

                    <div className="card space-y-4 border-primary/20 bg-primary/5">
                      <div className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Ask a follow-up</div>
                      <textarea
                        className="input-field min-h-[80px]"
                        placeholder="Based on the same document, what else would you like to know?"
                        value={qaQuestion}
                        onChange={(e) => setQaQuestion(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button 
                          className="btn-primary flex-1"
                          disabled={!qaQuestion.trim() || isQaLoading}
                          onClick={() => fetchQaAnswer(qaQuestion)}
                        >
                          Send Question
                        </button>
                        <button 
                          onClick={() => { setSelectedFile(null); setQaHistory([]); }}
                          className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-bold"
                        >
                          Clear & Start Over
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'library' && (
              <motion.div
                key="library"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="relative w-full sm:max-w-xs">
                    <input
                      type="text"
                      className="input-field pl-10"
                      placeholder="Search prompts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setLibraryFilter(cat)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                          libraryFilter === cat 
                            ? 'bg-dark-accent text-white' 
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="file" id="import-lib" className="hidden" accept=".json" onChange={importLibrary} />
                    <button 
                      onClick={() => document.getElementById('import-lib')?.click()}
                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors border border-slate-200 text-[10px] font-bold"
                      title="Import Library"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Import
                    </button>
                    <button 
                      onClick={exportLibrary}
                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors border border-slate-200 text-[10px] font-bold"
                      title="Export Library"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
                  {allPrompts
                    .filter(p => (libraryFilter === 'All' || p.department === libraryFilter) && 
                                (p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 p.description.toLowerCase().includes(searchQuery.toLowerCase()))).length > 0 ? (
                    allPrompts
                      .filter(p => (libraryFilter === 'All' || p.department === libraryFilter) && 
                                  (p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                   p.description.toLowerCase().includes(searchQuery.toLowerCase())))
                      .map((prompt) => (
                      <div key={prompt.id} className="card relative flex flex-col hover:shadow-md transition-shadow group h-full border-slate-200/60">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight ${
                              prompt.department === 'HR' ? 'bg-green-100 text-green-700' :
                              prompt.department === 'Sales' ? 'bg-blue-100 text-blue-700' :
                              prompt.department === 'Finance' ? 'bg-purple-100 text-purple-700' :
                              prompt.department === 'Operations' ? 'bg-orange-100 text-orange-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {prompt.department}
                            </span>
                            {prompt.isCustom && (
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold uppercase ring-1 ring-amber-400/30">
                                Custom
                              </span>
                            )}
                          </div>
                        </div>
                        <h3 className="font-bold text-lg mb-2 text-dark-accent">{prompt.name}</h3>
                        <p className="text-xs text-slate-500 mb-6 flex-1 line-clamp-2 leading-relaxed">
                          {prompt.description}
                        </p>
                        <div className="flex items-center gap-2 mt-auto">
                          <button 
                            onClick={() => {
                              setSelectedPrompt(prompt);
                              setChecklist(prev => ({ ...prev, prompt: true }));
                            }}
                            className="flex-1 px-4 py-2 bg-primary text-white hover:bg-primary-dark text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            Use This Prompt
                          </button>
                          <button 
                            onClick={() => { copyToClipboard(prompt.promptTemplate); addToast("Template copied!"); }}
                            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs font-bold rounded-lg transition-colors"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-1 md:col-span-2 py-12">
                      <EmptyState 
                        icon={Search} 
                        title="No matching prompts" 
                        description="Try adjusting your search query or filters to find what you're looking for."
                      />
                    </div>
                  )}
                  
                  {/* Add Custom Prompt Card */}
                  <button 
                    onClick={() => setIsAddingPrompt(true)}
                    className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition-all group"
                  >
                    <div className="bg-slate-100 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                      <Plus className="w-6 h-6 text-slate-400" />
                    </div>
                    <span className="font-bold text-slate-600 text-sm">Add Custom Prompt</span>
                    <p className="text-[10px] text-slate-400 mt-1">Grow your team's library</p>
                  </button>
                </div>

                <div className="h-20" />

                {/* Modals for Library */}
                <AnimatePresence>
                  {selectedPrompt && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-dark-accent/60 backdrop-blur-sm">
                      <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
                      >
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                          <div className="flex items-center gap-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              selectedPrompt.department === 'HR' ? 'bg-green-100 text-green-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {selectedPrompt.department}
                            </span>
                            <h3 className="text-xl font-bold text-dark-accent">{selectedPrompt.name}</h3>
                          </div>
                          <button onClick={() => setSelectedPrompt(null)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-400"><X className="w-5 h-5" /></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                           <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Live Prompt Template</label>
                              <div className="bg-slate-900 rounded-xl p-4 font-mono text-sm relative group overflow-hidden">
                                {/* The highlighting layer */}
                                <div className="absolute inset-0 p-4 leading-relaxed whitespace-pre-wrap pointer-events-none text-transparent">
                                  {filledPrompt.split(/(\[[^\]]+\])/).map((part, i) => 
                                    part.startsWith('[') && part.endsWith(']') ? (
                                      <span key={i} className="bg-yellow-500/30 text-yellow-200 rounded px-0.5">{part}</span>
                                    ) : (
                                      <span key={i}>{part}</span>
                                    )
                                  )}
                                </div>
                                <textarea
                                  className="w-full bg-transparent text-slate-300 border-none outline-none resize-none h-[180px] leading-relaxed relative z-10"
                                  value={filledPrompt}
                                  onChange={(e) => setEditedTemplate(e.target.value)}
                                  spellCheck={false}
                                />
                              </div>
                              <p className="text-[10px] text-slate-400 mt-2 italic flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Highlighted <span className="text-yellow-500/80 font-bold">[PLACEHOLDERS]</span> update in real-time as you fill the fields below.
                              </p>
                           </div>

                           <div className="space-y-4">
                              <h4 className="text-sm font-bold text-dark-accent border-b border-slate-100 pb-2 flex items-center gap-2">
                                <Settings className="w-4 h-4 text-slate-400" />
                                Fill Placeholders
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {Object.keys(formValues).map(key => (
                                  <div key={key}>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{key.replace(/_/g, ' ')}</label>
                                    <input 
                                      type="text" 
                                      className="input-field py-2 text-sm"
                                      placeholder={`Enter ${key.toLowerCase()}`}
                                      value={formValues[key]}
                                      onChange={(e) => setFormValues(prev => ({ ...prev, [key]: e.target.value }))}
                                    />
                                  </div>
                                ))}
                                {Object.keys(formValues).length === 0 && (
                                  <div className="col-span-2 text-xs text-slate-400 italic">No placeholders detected in this template.</div>
                                )}
                              </div>
                           </div>
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                          <button 
                            className="flex-1 btn-primary"
                            onClick={() => {
                              copyToClipboard(filledPrompt);
                              addToast("Prompt copied! Paste into Google AI Studio.");
                              setSelectedPrompt(null);
                            }}
                          >
                            <Zap className="w-4 h-4" />
                            Run in AI Studio
                          </button>
                          <button 
                            onClick={() => setSelectedPrompt(null)}
                            className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold text-sm"
                          >
                            Close
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  )}

                  {isAddingPrompt && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-dark-accent/60 backdrop-blur-sm">
                      <motion.div 
                         initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                         className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
                      >
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                          <h3 className="text-lg font-bold text-dark-accent">Add Custom Prompt</h3>
                          <button onClick={() => setIsAddingPrompt(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Prompt Name</label>
                            <input 
                              className="input-field" 
                              placeholder="e.g. Content Re-writer" 
                              value={newPromptForm.name} 
                              onChange={e => setNewPromptForm({...newPromptForm, name: e.target.value})} 
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Department</label>
                            <select 
                              className="input-field appearance-none bg-white"
                              value={newPromptForm.department}
                              onChange={e => setNewPromptForm({...newPromptForm, department: e.target.value as Prompt['department']})}
                            >
                              {categories.filter(c => c !== 'All').concat('Other').map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                            <input 
                              className="input-field" 
                              placeholder="Short explanation of what this does..." 
                              value={newPromptForm.description} 
                              onChange={e => setNewPromptForm({...newPromptForm, description: e.target.value})} 
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Prompt Template</label>
                            <textarea 
                              className="input-field h-[120px]" 
                              placeholder="Use [BRACKETS] for placeholders..." 
                              value={newPromptForm.promptTemplate} 
                              onChange={e => setNewPromptForm({...newPromptForm, promptTemplate: e.target.value})} 
                            />
                          </div>
                          <button onClick={saveCustomPrompt} className="btn-primary w-full mt-4">Save to Library</button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 p-8 mt-auto">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-slate-500 text-sm">
            <span className="font-bold text-dark-accent">BizAssist AI</span> — Built in Session 1 • {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          <a 
            href="https://ai.studio" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary font-semibold text-sm hover:underline flex items-center gap-1.5"
          >
            Powered by Google AI Studio
          </a>
        </div>
      </footer>

      {/* API Key Modal */}
      <AnimatePresence>
        {isApiKeyModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-dark-accent/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="bg-primary/10 p-1.5 rounded-lg">
                    <Settings className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-dark-accent tracking-tight">AI Settings</h3>
                </div>
                <button 
                  onClick={() => {
                    setIsApiKeyModalOpen(false);
                    setTestResult(null);
                  }} 
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    BizAssist AI uses the <span className="text-primary font-bold">Gemini 2.5 Flash</span> model to process your documents and notes securely.
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Gemini API Key</label>
                    <a 
                      href="https://aistudio.google.com/app/apikey" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-[10px] text-primary font-bold hover:underline flex items-center gap-1"
                    >
                      Get API Key <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <input
                    type="password"
                    className="input-field font-mono"
                    placeholder="Enter your key here..."
                    value={newApiKey}
                    onChange={(e) => {
                      setNewApiKey(e.target.value);
                      setTestResult(null);
                    }}
                  />
                  <p className="text-[10px] text-slate-400 mt-2 font-medium italic">
                    Key is stored locally in your browser.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={testConnection}
                    disabled={!newApiKey.trim() || isTestingKey}
                    className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${
                      testResult === 'success' ? 'bg-green-50 border-green-200 text-green-700' :
                      testResult === 'failed' ? 'bg-red-50 border-red-200 text-red-700' :
                      'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {isTestingKey ? <LoadingSpinner /> : <Zap className="w-3.5 h-3.5" />}
                    {testResult === 'success' ? 'Connected' : testResult === 'failed' ? 'Test Failed' : 'Test Connection'}
                  </button>
                  <button 
                    onClick={() => {
                      saveApiKey();
                      setApiKey(newApiKey);
                      localStorage.setItem('geminiApiKey', newApiKey);
                      setChecklist(prev => ({ ...prev, key: true }));
                      setIsApiKeyModalOpen(false);
                      addToast("Settings saved!");
                    }}
                    className="flex-1 btn-primary"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Welcome Modal */}
      <AnimatePresence>
        {showWelcome && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-dark-accent/70 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden border border-white/20 relative"
            >
              <button 
                onClick={dismissWelcome}
                className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="p-10 text-center space-y-6">
                <div className="flex justify-center">
                  <div className="bg-primary/10 p-5 rounded-[24px]">
                    <Zap className="w-12 h-12 text-primary fill-primary/20" strokeWidth={1.5} />
                  </div>
                </div>
                <div>
                  <h2 className="text-3xl font-extrabold text-dark-accent tracking-tight mb-2">Welcome to BizAssist AI</h2>
                  <p className="text-slate-500 text-sm leading-relaxed max-w-sm mx-auto">
                    Your AI-powered executive assistant for meetings, emails, and document intelligence.
                  </p>
                </div>

                <div className="space-y-3 max-w-xs mx-auto pt-4">
                  {[
                    { id: 'key', label: 'Add Gemini API key in Settings', icon: Settings },
                    { id: 'meeting', label: 'Try the Meeting Summariser', icon: FileText },
                    { id: 'prompt', label: 'Browse the Prompt Library', icon: Bookmark },
                  ].map((step) => (
                    <div 
                      key={step.id}
                      className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                        checklist[step.id as keyof typeof checklist] 
                          ? 'bg-green-50 border-green-100 text-green-700' 
                          : 'bg-slate-50 border-slate-100 text-slate-500'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg ${checklist[step.id as keyof typeof checklist] ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                        {checklist[step.id as keyof typeof checklist] ? <CheckCircle2 className="w-3.5 h-3.5" /> : <step.icon className="w-3.5 h-3.5" />}
                      </div>
                      <span className="text-xs font-bold text-left">{step.label}</span>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={dismissWelcome}
                  className="btn-primary w-full py-4 text-base shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Get Started
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              className="bg-dark-accent text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-white/10 backdrop-blur-sm"
            >
              <div className="bg-primary/20 p-1 rounded-full">
                <CheckCircle2 className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-medium">{toast.message}</span>
              <button 
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="ml-2 text-white/40 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
