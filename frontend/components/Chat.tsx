import { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { aptosClient } from "@/utils/aptosClient";
import {
  MessageSquare,
  Send,
  Bot,
  User,
  Loader,
  X
} from 'lucide-react';
import axios from 'axios';
import { toast, Toaster } from 'react-hot-toast';
import "@/index.css"
import { useWallet } from '@aptos-labs/wallet-adapter-react';

interface Document {
  id: number;
  content_hash: string;
  creator: string;
  signers: string[];
  signatures: string[];
  is_completed: boolean;
  category?: string;
  extractedContent?: string;
  signerDetails?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
}

interface ProcessedDocument {
  id: number;
  summary: string;
  signerInfo: string;
  category: string;
  status: string;
}

interface ChatWithDocsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatWithDocs({ isOpen, onClose }: ChatWithDocsProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [processedDocs, setProcessedDocs] = useState<ProcessedDocument[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [genAI, setGenAI] = useState<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { account } = useWallet();

  const moduleAddress = import.meta.env.VITE_APP_MODULE_ADDRESS;
  const moduleName = import.meta.env.VITE_APP_MODULE_NAME;
  const API_KEY = process.env.VITE_GEMINI_API_KEY;

  useEffect(() => {
    if (!API_KEY) {
      console.error('API key is not defined');
      return;
    }
    const ai = new GoogleGenerativeAI(API_KEY);
    setGenAI(ai);
  }, []);
  
  useEffect(() => {
    if (genAI) {
      fetchAndProcessDocuments();
    }
  }, [genAI]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const analyzeDocument = async (content: string | Blob, model: any): Promise<string> => {
    try {
      let textContent = '';
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.readAsDataURL(content as Blob);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });

      const base64Content = base64Data.split(',')[1];
      const fileType = (content as Blob).type;

      if (fileType.includes('image')) {
        const result = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [
              { text: "Analyze this image and provide a detailed summary of its content, including any visible text, key information, and important details." },
              { inlineData: { mimeType: fileType, data: base64Content }}
            ]
          }]
        });
        textContent = result.response.text();
      } else {
        const result = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [
              { text: "Provide a comprehensive summary of this document's content, highlighting key points, important details, and any significant information." },
              { inlineData: { mimeType: fileType, data: base64Content }}
            ]
          }]
        });
        textContent = result.response.text();
      }
      return textContent;
    } catch (error) {
      console.error('Error analyzing document:', error);
      return 'Error analyzing document content';
    }
  };

  

  const fetchAndProcessDocuments = async () => {
    setIsLoading(true);
    try {
      const response = await aptosClient().view<[Document[]]>({
        payload: {
          function: `${moduleAddress}::${moduleName}::get_all_documents`,
          typeArguments: [],
          functionArguments: [],
        }
      });
  
      if (Array.isArray(response) && response.length > 0 && account) {
        // Filter documents created by the connected account
        const userDocuments = response[0].filter(doc => doc.creator === account.address);
        
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const processedDocuments: ProcessedDocument[] = [];
  
        for (const doc of userDocuments) {  // Process only user's documents
          try {
            // Fetch and analyze document content
            const content = await axios.get(`https://gateway.pinata.cloud/ipfs/${doc.content_hash}`, {
              responseType: 'blob'
            });
            
            const summary = await analyzeDocument(content.data, model);
            
            // Get signer information
            const signerInfo = `Signers: ${doc.signers.join(', ')}\nSignatures Completed: ${doc.signatures.length}/${doc.signers.length}`;
            
            processedDocuments.push({
              id: doc.id,
              summary,
              signerInfo,
              category: doc.category || 'uncategorized',
              status: doc.is_completed ? 'completed' : 'pending'
            });
          } catch (error) {
            console.error(`Error processing document ${doc.id}:`, error);
          }
        }
  
        setProcessedDocs(processedDocuments);
        setDocuments(userDocuments);  // Store only user's documents
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast.error("Failed to load documents");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChat = async () => {
    if (!userInput.trim()) return;
    setIsSending(true);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userInput
    };
    setChatMessages(prev => [...prev, userMessage]);
    setUserInput('');

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      // Create detailed context with document summaries and signer info
      const context = processedDocs.map(doc => 
        `Document ID: ${doc.id}
         Summary: ${doc.summary}
         ${doc.signerInfo}
         Category: ${doc.category}
         Status: ${doc.status}`
      ).join('\n\n==========\n\n');

      const prompt = `You are an AI assistant with detailed knowledge of these documents:

      ${context}

      User Query: "${userInput}"

      Instructions for response:
      1. If the query is about specific documents, reference them by ID and provide relevant details
      2. Include relevant signer information when discussing document status
      3. If the query relates to multiple documents, compare and contrast them
      4. If you can't find relevant information, clearly state that
      5. Be specific and cite document IDs when providing information

      Please provide a detailed and accurate response:`;

      const chatResult = await model.generateContent(prompt);
      
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: chatResult.response.text()
      };

      setChatMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'ai',
        content: 'Sorry, I encountered an error while processing your request. Please try again.'
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-xl w-full max-w-4xl h-[90vh] flex items-center justify-center">
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin mx-auto" />
            <p className="text-gray-600 animate-pulse">Loading and analyzing documents...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
        <Toaster />
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <MessageSquare className="w-6 h-6 text-blue-400" />
              <h1 className="text-2xl font-bold text-gray-800">Document Assistant</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                {documents.length} documents analyzed
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {chatMessages.length === 0 ? (
            <div className="text-center text-gray-600 mt-12 space-y-4">
              <Bot className="w-16 h-16 mx-auto text-blue-500/50" />
              <div className="space-y-2">
                <p className="font-medium text-gray-800">Ready to assist with your documents</p>
                <p className="text-sm">Ask me about document contents, signers, or status!</p>
              </div>
            </div>
          ) : (
            chatMessages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom`}
              >
                <div className={`max-w-[80%] rounded-lg p-4 flex space-x-3 shadow-sm
                  ${msg.role === 'user'
                    ? 'bg-blue-50 border border-blue-200'
                    : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  {msg.role === 'ai' ? (
                    <Bot className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                  ) : (
                    <User className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                  )}
                  <p className="text-sm whitespace-pre-wrap text-gray-800">{msg.content}</p>
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleChat();
            }}
            className="flex space-x-2"
          >
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Ask about document contents, signers, or status..."
              className="flex-1 px-4 py-2 rounded-lg bg-white border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors text-gray-800 placeholder-gray-500"
            />
            <button
              type="submit"
              disabled={isSending || !userInput.trim()}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 text-white shadow-sm"
            >
              {isSending ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}